// Main Application Controller Logic

    // System State Variables
    let currentSection = 'home';
    let currentReviewTab = '15-1';
    let currentSim2SubTab = 'charge';
    let currentPracticeTopic = '15-1';
    let currentPracticeQuestion = null;

    let currentExamQuestions = [];
    let examTimerInterval = null;
    let examTimeRemaining = 900;
    const EXAM_DURATION_SECONDS = 900;
    const EXAM_STATE_KEY = 'active_exam_session_v6';
    let examStartTimestamp = null;
    let examDeadlineTimestamp = null;
    let examIsActive = false;
    let examSubmissionInProgress = false;
    let examStudentInfo = {};
    let examExitGuardEnabled = false;
    let examTouchStartY = 0;
    let examFocusLossCount = 0;
    let examConfirmingSubmit = false;

    let wireAnimFrame = null;
    let wireActive = false;
    let wirePos = 120;
    let wireVel = 0;
    let wireAcc = 0;
    let wireLastTime = 0;

    function getCurrentExamRemainingSeconds() {
      if (!examDeadlineTimestamp) return examTimeRemaining;
      return Math.max(0, Math.ceil((examDeadlineTimestamp - Date.now()) / 1000));
    }

    function getCurrentExamAnswers() {
      const answers = [];
      currentExamQuestions.forEach((q, idx) => {
        if (q.type === 'choice') {
          const checked = document.querySelector(`input[name="exam-q${idx}"]:checked`);
          answers.push(checked ? checked.value : null);
        } else if (q.type === 'numeric_single') {
          const val = document.getElementById(`exam-q${idx}-val1`).value;
          answers.push([val]);
        } else if (q.type === 'numeric_double') {
          const val1 = document.getElementById(`exam-q${idx}-val1`).value;
          const val2 = document.getElementById(`exam-q${idx}-val2`).value;
          answers.push([val1, val2]);
        }
      });
      return answers;
    }

    function restoreExamAnswers(answers) {
      if (!answers) return;
      answers.forEach((ans, idx) => {
        const q = currentExamQuestions[idx];
        if (!q) return;
        if (q.type === 'choice') {
          if (ans) {
            const radio = document.querySelector(`input[name="exam-q${idx}"][value="${ans}"]`);
            if (radio) radio.checked = true;
          }
        } else if (q.type === 'numeric_single') {
          if (ans && ans[0]) document.getElementById(`exam-q${idx}-val1`).value = ans[0];
        } else if (q.type === 'numeric_double') {
          if (ans) {
            if (ans[0]) document.getElementById(`exam-q${idx}-val1`).value = ans[0];
            if (ans[1]) document.getElementById(`exam-q${idx}-val2`).value = ans[1];
          }
        }
      });
    }

    function persistExamSession() {
      if (!examIsActive || !currentExamQuestions.length || !examStartTimestamp || !examDeadlineTimestamp) return;
      const payload = {
        examQuestions: currentExamQuestions,
        studentInfo: examStudentInfo,
        examStartTimestamp,
        examDeadlineTimestamp,
        answers: getCurrentExamAnswers(),
        focusLossCount: examFocusLossCount
      };
      localStorage.setItem(EXAM_STATE_KEY, JSON.stringify(payload));
    }

    function clearExamSession() {
      localStorage.removeItem(EXAM_STATE_KEY);
    }

    let examFocusLostActive = false;
    function handleExamFocusLoss() {
      if (!examIsActive || examSubmissionInProgress || examConfirmingSubmit || examFocusLostActive) return;
      examFocusLostActive = true;
      setTimeout(() => {
        examFocusLostActive = false;
      }, 1000);
      
      examFocusLossCount++;
      const displayEl = document.getElementById('exam-focus-loss-display');
      if (displayEl) displayEl.innerText = examFocusLossCount;
      persistExamSession();
      
      triggerAlert(
        "ตรวจพบการออกนอกหน้าต่างสอบ!",
        `คุณได้สลับแท็บหรือสลับหน้าจอ (ครั้งที่ ${examFocusLossCount}) กรุณาทำข้อสอบให้เสร็จสิ้นในหน้านี้โดยไม่สลับหน้าเพื่อความโปร่งใสครับ`,
        "fa-triangle-exclamation",
        "bg-amber-100 text-amber-600"
      );
    }

    function handleExamVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        handleExamFocusLoss();
      }
    }

    function stopExamExitGuard() {
      if (!examExitGuardEnabled) return;
      window.removeEventListener('beforeunload', handleExamBeforeUnload);
      window.removeEventListener('popstate', handleExamPopState);
      window.removeEventListener('keydown', handleExamKeydown, true);
      window.removeEventListener('touchstart', handleExamTouchStart);
      window.removeEventListener('touchmove', handleExamTouchMove);
      window.removeEventListener('blur', handleExamFocusLoss);
      document.removeEventListener('visibilitychange', handleExamVisibilityChange);
      document.documentElement.classList.remove('exam-locked');
      document.body.classList.remove('exam-locked');
      examExitGuardEnabled = false;
    }

    function startExamExitGuard() {
      if (examExitGuardEnabled) return;
      window.addEventListener('beforeunload', handleExamBeforeUnload);
      window.addEventListener('popstate', handleExamPopState);
      window.addEventListener('keydown', handleExamKeydown, true);
      window.addEventListener('touchstart', handleExamTouchStart, { passive: true });
      window.addEventListener('touchmove', handleExamTouchMove, { passive: false });
      window.addEventListener('blur', handleExamFocusLoss);
      document.addEventListener('visibilitychange', handleExamVisibilityChange);
      document.documentElement.classList.add('exam-locked');
      document.body.classList.add('exam-locked');
      examExitGuardEnabled = true;
    }

    function handleExamBeforeUnload(event) {
      if (!examIsActive) return;
      persistExamSession();
      event.preventDefault();
      event.returnValue = '';
      return '';
    }

    function handleExamPopState() {
      if (!examIsActive) return;
      history.pushState({ examLock: true }, '', location.href);
      triggerAlert("กำลังสอบอยู่", "ระบบล็อกการย้อนกลับไว้ระหว่างทำข้อสอบ เพื่อป้องกันการหลุดจากการสอบโดยไม่ตั้งใจ", "fa-ban", "bg-amber-100 text-amber-600");
      showSection('exam-live');
    }

    function handleExamKeydown(event) {
      if (!examIsActive) return;
      const key = event.key.toLowerCase();
      const blocked = event.key === 'F5' || ((event.ctrlKey || event.metaKey) && key === 'r') || (event.altKey && key === 'arrowleft');
      if (blocked) {
        event.preventDefault();
        event.stopPropagation();
        triggerAlert("กำลังสอบอยู่", "ระบบปิดการรีเฟรชและย้อนหน้าไว้ชั่วคราว เพื่อให้เวลาสอบเดินต่อเนื่องตลอด 15 นาที", "fa-lock", "bg-amber-100 text-amber-600");
      }
    }

    function handleExamTouchStart(event) {
      if (!examIsActive || !event.touches || event.touches.length !== 1) return;
      examTouchStartY = event.touches[0].clientY;
    }

    function handleExamTouchMove(event) {
      if (!examIsActive || !event.touches || event.touches.length !== 1) return;
      const currentY = event.touches[0].clientY;
      const pullingDownFromTop = window.scrollY <= 0 && currentY > examTouchStartY + 8;
      if (pullingDownFromTop) {
        event.preventDefault();
      }
    }

    function startExamTimer() {
      clearInterval(examTimerInterval);
      const updateTimer = () => {
        if (!examIsActive) return;
        examTimeRemaining = getCurrentExamRemainingSeconds();
        document.getElementById('exam-timer-display').innerText = formatExamTime(examTimeRemaining);
        
        // อัปเดตแถบความคืบหน้าของเวลา (Progress Bar)
        const progressEl = document.getElementById('exam-timer-progress');
        if (progressEl) {
          const percent = (examTimeRemaining / EXAM_DURATION_SECONDS) * 100;
          progressEl.style.width = `${percent}%`;
          if (examTimeRemaining < 60) {
            progressEl.className = "h-full bg-rose-500 rounded-full transition-all duration-300 animate-pulse";
            document.getElementById('exam-timer-display').classList.add('text-rose-500');
          } else if (examTimeRemaining < 300) {
            progressEl.className = "h-full bg-amber-400 rounded-full transition-all duration-300";
            document.getElementById('exam-timer-display').classList.remove('text-rose-500');
          } else {
            progressEl.className = "h-full bg-cyan-400 rounded-full transition-all duration-300";
            document.getElementById('exam-timer-display').classList.remove('text-rose-500');
          }
        }

        persistExamSession();
        if (examTimeRemaining <= 0) {
          clearInterval(examTimerInterval);
          examTimeRemaining = 0;
          document.getElementById('exam-timer-display').innerText = "00:00";
          triggerAlert("หมดเวลาแล้ว!", "เวลาสอบ 15 นาทีของคุณหมดแล้ว ระบบจะส่งข้อสอบและเฉลยให้ทันที", "fa-hourglass-end", "bg-rose-100 text-rose-600");
          submitExam(true);
        }
      };
      updateTimer();
      examTimerInterval = setInterval(updateTimer, 250);
    }

    function initializeExamSession(questions, studentInfo) {
      currentExamQuestions = questions;
      examStudentInfo = studentInfo;
      examStartTimestamp = Date.now();
      examDeadlineTimestamp = examStartTimestamp + (EXAM_DURATION_SECONDS * 1000);
      examTimeRemaining = EXAM_DURATION_SECONDS;
      examIsActive = true;
      examSubmissionInProgress = false;
      examFocusLossCount = 0;
      const displayEl = document.getElementById('exam-focus-loss-display');
      if (displayEl) displayEl.innerText = '0';
      startExamExitGuard();
      history.pushState({ examLock: true }, '', location.href);
      persistExamSession();
      startExamTimer();
    }

    function restoreActiveExamSession() {
      const saved = localStorage.getItem(EXAM_STATE_KEY);
      if (!saved) return false;
      try {
        const parsed = JSON.parse(saved);
        if (!parsed || !parsed.examQuestions || !parsed.studentInfo || !parsed.examDeadlineTimestamp) return false;
        currentExamQuestions = parsed.examQuestions;
        examStudentInfo = parsed.studentInfo;
        examStartTimestamp = parsed.examStartTimestamp || (parsed.examDeadlineTimestamp - (EXAM_DURATION_SECONDS * 1000));
        examDeadlineTimestamp = parsed.examDeadlineTimestamp;
        examIsActive = true;
        examSubmissionInProgress = false;
        examFocusLossCount = parsed.focusLossCount || 0;

        document.getElementById('lbl-exam-user-info').innerText = `${examStudentInfo.name} (ม.6/${examStudentInfo.class} เลขที่ ${examStudentInfo.number})`;
        const displayEl = document.getElementById('exam-focus-loss-display');
        if (displayEl) displayEl.innerText = examFocusLossCount;

        renderExamLiveDOM();
        restoreExamAnswers(parsed.answers);
        showSection('exam-live');

        const remaining = getCurrentExamRemainingSeconds();
        examTimeRemaining = remaining;
        document.getElementById('exam-timer-display').innerText = formatExamTime(remaining);
        document.getElementById('exam-timer-display').classList.toggle('text-rose-500', remaining < 60);

        startExamExitGuard();
        if (remaining <= 0) {
          submitExam(true);
        } else {
          startExamTimer();
        }
        return true;
      } catch (error) {
        console.error('Failed to restore exam session:', error);
        clearExamSession();
        return false;
      }
    }

    function endExamSession() {
      examIsActive = false;
      examSubmissionInProgress = false;
      examStartTimestamp = null;
      examDeadlineTimestamp = null;
      clearInterval(examTimerInterval);
      stopExamExitGuard();
      clearExamSession();
    }

    function renderMath() {
      if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
        MathJax.typesetPromise().catch(function (err) {
          console.error("MathJax error: ", err);
        });
      }
    }

    window.onload = function () {
      updateLatestScoreOnHome();
      switchReviewTab('15-1');
      renderMath();
      restoreActiveExamSession();
    }

    document.addEventListener('input', function (event) {
      if (!examIsActive || !event.target || !event.target.id) return;
      if (event.target.id.startsWith('exam-q')) {
        persistExamSession();
      }
    });

    function showSection(sectionId) {
      let norm = sectionId.startsWith('sec-') ? sectionId.slice(4) : sectionId;
      if (examIsActive && norm !== 'exam-live' && norm !== 'exam-result') {
        triggerAlert("กำลังสอบอยู่", "ระบบล็อกไม่ให้ออกจากหน้าทดสอบจนกว่าจะกดส่งข้อสอบหรือหมดเวลาครับ", "fa-lock", "bg-amber-100 text-amber-600");
        norm = 'exam-live';
      }
      const mobileMenu = document.getElementById('mobile-menu');
      if (mobileMenu) mobileMenu.classList.add('hidden');

      const sections = ['home', 'review', 'practice', 'exam-start', 'exam-live', 'exam-result'];
      sections.forEach(s => {
        const sec = document.getElementById('sec-' + s);
        if (sec) {
          if (s === norm) sec.classList.remove('hidden');
          else sec.classList.add('hidden');
        }
      });

      if (norm !== 'exam-live' && !examIsActive) {
        clearInterval(examTimerInterval);
      }
      currentSection = norm;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      renderMath();
    }

    function toggleMobileMenu() {
      const mobileMenu = document.getElementById('mobile-menu');
      if (mobileMenu) mobileMenu.classList.toggle('hidden');
    }

    function triggerAlert(title, message, iconClass = 'fa-circle-exclamation', iconColorClass = 'bg-rose-100 text-rose-600') {
      const modal = document.getElementById('modal-alert');
      const card = document.getElementById('modal-alert-card');
      const icon = document.getElementById('modal-alert-icon');

      document.getElementById('modal-alert-title').innerText = title;
      document.getElementById('modal-alert-msg').innerText = message;
      icon.className = `w-14 h-14 rounded-full mx-auto flex items-center justify-center text-2xl ${iconColorClass}`;
      icon.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;

      modal.classList.remove('hidden');
      setTimeout(() => {
        card.classList.remove('scale-95', 'opacity-0');
        card.classList.add('scale-100', 'opacity-100');
      }, 50);
    }

    function closeAlertModal() {
      const modal = document.getElementById('modal-alert');
      const card = document.getElementById('modal-alert-card');
      card.classList.remove('scale-100', 'opacity-100');
      card.classList.add('scale-95', 'opacity-0');
      setTimeout(() => {
        modal.classList.add('hidden');
      }, 200);
    }

    function updateLatestScoreOnHome() {
      const saved = localStorage.getItem('last_exam_results');
      const badge = document.getElementById('latest-score-badge');
      if (saved) {
        const info = JSON.parse(saved);
        const finishedLabel = info.finishedAtDisplay || info.date || 'ไม่พบเวลาส่ง';
        document.getElementById('lbl-last-score').innerText = `${info.score} / 10 คะแนน (${info.studentInfo?.name || info.name || '-'}) • ${finishedLabel}`;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }

    function showLatestResultModal() {
      const saved = localStorage.getItem('last_exam_results');
      if (saved) {
        const info = JSON.parse(saved);
        currentExamQuestions = info.examQuestions || [];
        showSection('exam-result');
        displayExamResults(info.score, info.gradedResults, info.timeTaken, info.studentInfo, info.finishedAtDisplay || info.date || '-', info.focusLossCount || 0);
      }
    }

    function switchReviewTab(tabName) {
      currentReviewTab = tabName;
      const tabs = ['15-1', '15-2', '15-3'];
      tabs.forEach(t => {
        const btn = document.getElementById(`btn-tab-${t}`);
        const tab = document.getElementById(`review-tab-${t}`);
        if (t === tabName) {
          btn.className = "flex-1 text-center py-2 text-xs md:text-sm font-bold rounded-lg transition-all duration-200 bg-white text-blue-900 shadow-sm";
          tab.classList.remove('hidden');
        } else {
          btn.className = "flex-1 text-center py-2 text-xs md:text-sm font-bold rounded-lg transition-all duration-200 text-slate-600 hover:text-slate-900";
          tab.classList.add('hidden');
        }
      });
      resetWireSim();
      if (tabName === '15-1') initFluxSimulator();
      else if (tabName === '15-2') switchSim2SubTab(currentSim2SubTab);
      else if (tabName === '15-3') initMomentSimulator();
    }

    function initFluxSimulator() {
      const sliderAngle = document.getElementById('sim1-slider-angle');
      const sliderField = document.getElementById('sim1-slider-field');
      const sliderArea = document.getElementById('sim1-slider-area');
      const update = () => {
        const angle = parseFloat(sliderAngle.value);
        const B = parseFloat(sliderField.value);
        const A_cm2 = parseFloat(sliderArea.value);
        document.getElementById('lbl-sim1-angle').innerHTML = `$${angle}^\\circ$`;
        document.getElementById('lbl-sim1-field').innerHTML = `$${B.toFixed(1)}\\text{ T}$`;
        document.getElementById('lbl-sim1-area').innerHTML = `$${A_cm2}\\text{ cm}^2$`;
        const A_m2 = A_cm2 * 1e-4;
        const flux = B * A_m2 * Math.sin(angle * Math.PI / 180);
        document.getElementById('lbl-sim1-calc').innerHTML = `$\\Phi = ${B.toFixed(1)} \\times (${A_cm2} \\times 10^{-4}) \\times \\sin(${angle}^\\circ)$`;
        document.getElementById('lbl-sim1-result').innerHTML = `$${formatSci(flux)}\\text{ Wb}$`;
        renderMath();
        drawFluxSim(angle, B, A_cm2);
      };
      sliderAngle.addEventListener('input', update);
      sliderField.addEventListener('input', update);
      sliderArea.addEventListener('input', update);
      update();
    }


    function initChargeSimulator() {
      const selectCharge = document.getElementById('sim2-select-charge');
      const sliderVelocity = document.getElementById('sim2-slider-velocity');
      const sliderField = document.getElementById('sim2-slider-field');
      const update = () => {
        const chargeType = selectCharge.value;
        const vVal = parseFloat(sliderVelocity.value);
        const BVal = parseFloat(sliderField.value);
        document.getElementById('lbl-sim2-charge').innerHTML = chargeType === 'positive' ? 'บวก ($+1.6 \\times 10^{-19}\\text{ C}$)' : 'ลบ ($-1.6 \\times 10^{-19}\\text{ C}$)';
        document.getElementById('lbl-sim2-velocity').innerHTML = `$${vVal.toFixed(1)} \\times 10^6\\text{ m/s}$`;
        document.getElementById('lbl-sim2-field').innerHTML = `$${BVal.toFixed(1)}\\text{ mT}$`;
        const q = 1.6e-19;
        const v = vVal * 1e6;
        const B = BVal * 1e-3;
        const force = q * v * B;
        document.getElementById('lbl-sim2-calc').innerHTML = `$F = (1.6 \\times 10^{-19}) \\times (${vVal.toFixed(1)} \\times 10^6) \\times (${BVal.toFixed(1)} \\times 10^{-3})$`;
        document.getElementById('lbl-sim2-result').innerHTML = `$${formatSci(force)}\\text{ N}$`;
        renderMath();
        drawChargeSim(chargeType, vVal, BVal);
      };
      selectCharge.addEventListener('change', update);
      sliderVelocity.addEventListener('input', update);
      sliderField.addEventListener('input', update);
      update();
    }


    function resetChargeSim() {
      const selectCharge = document.getElementById('sim2-select-charge');
      if (selectCharge) selectCharge.dispatchEvent(new Event('change'));
    }

    function initWireSimulator() {
      const sliderCurrent = document.getElementById('sim2-slider-wire-current');
      const sliderField = document.getElementById('sim2-slider-wire-field');
      const sliderLength = document.getElementById('sim2-slider-wire-length');
      const sliderMass = document.getElementById('sim2-slider-wire-mass');
      const update = () => {
        const I = parseFloat(sliderCurrent.value);
        const B = parseFloat(sliderField.value);
        const l_cm = parseFloat(sliderLength.value);
        const m_g = parseFloat(sliderMass.value);
        document.getElementById('lbl-sim2-wire-current').innerHTML = `$${I.toFixed(1)}\\text{ A}$`;
        document.getElementById('lbl-sim2-wire-field').innerHTML = `$${B.toFixed(1)}\\text{ T}$`;
        document.getElementById('lbl-sim2-wire-length').innerHTML = `$${l_cm}\\text{ cm}$`;
        document.getElementById('lbl-sim2-wire-mass').innerHTML = `$${m_g}\\text{ g}$`;
        const l_m = l_cm * 1e-2;
        const force = I * l_m * B;
        const m_kg = m_g * 1e-3;
        const acc = force / m_kg;
        document.getElementById('lbl-sim2-wire-calc').innerHTML = `$F = ${I.toFixed(1)} \\times ${l_m.toFixed(2)} \\times ${B.toFixed(1)} = ${force.toFixed(3)}\\text{ N}$`;
        document.getElementById('lbl-sim2-wire-force-res').innerHTML = `$${force.toFixed(3)}\\text{ N}$`;
        document.getElementById('lbl-sim2-wire-acc-res').innerHTML = `$${acc.toFixed(1)}\\text{ m/s}^2$`;
        renderMath();
        drawWireSimStatic(wirePos, I, B, l_cm);
      };
      sliderCurrent.addEventListener('input', update);
      sliderField.addEventListener('input', update);
      sliderLength.addEventListener('input', update);
      sliderMass.addEventListener('input', update);
      update();
    }


    function startWireSim() {
      if (wireActive) return;
      wireActive = true;
      wirePos = 80;
      wireVel = 0;
      const sliderCurrent = document.getElementById('sim2-slider-wire-current');
      const sliderField = document.getElementById('sim2-slider-wire-field');
      const sliderLength = document.getElementById('sim2-slider-wire-length');
      const sliderMass = document.getElementById('sim2-slider-wire-mass');
      const I = parseFloat(sliderCurrent.value);
      const B = parseFloat(sliderField.value);
      const l_cm = parseFloat(sliderLength.value);
      const m_g = parseFloat(sliderMass.value);
      const l_m = l_cm * 1e-2;
      const force = I * l_m * B;
      const m_kg = m_g * 1e-3;
      wireAcc = force / m_kg;
      const accScaled = wireAcc * 50;
      wireLastTime = performance.now();
      const loop = (time) => {
        if (!wireActive) return;
        const dt = (time - wireLastTime) / 1000;
        wireLastTime = time;
        wireVel += accScaled * dt;
        wirePos += wireVel * dt;
        if (wirePos >= 300) {
          wirePos = 300;
          wireActive = false;
        }
        drawWireSimStatic(wirePos, I, B, l_cm);
        if (wireActive) wireAnimFrame = requestAnimationFrame(loop);
      };
      wireAnimFrame = requestAnimationFrame(loop);
    }

    function resetWireSim() {
      wireActive = false;
      cancelAnimationFrame(wireAnimFrame);
      wirePos = 120;
      const sliderCurrent = document.getElementById('sim2-slider-wire-current');
      if (sliderCurrent) sliderCurrent.dispatchEvent(new Event('input'));
    }

    function switchSim2SubTab(subTabName) {
      currentSim2SubTab = subTabName;
      const btnCharge = document.getElementById('btn-sim2-tab-charge');
      const btnWire = document.getElementById('btn-sim2-tab-wire');
      const panelCharge = document.getElementById('sim2-charge-panel');
      const panelWire = document.getElementById('sim2-wire-panel');
      if (subTabName === 'charge') {
        btnCharge.className = "flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all duration-200 bg-white text-indigo-900 shadow-sm";
        btnWire.className = "flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all duration-200 text-slate-600 hover:text-slate-900";
        panelCharge.classList.remove('hidden');
        panelWire.classList.add('hidden');
        resetWireSim();
        initChargeSimulator();
      } else {
        btnWire.className = "flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all duration-200 bg-white text-indigo-900 shadow-sm";
        btnCharge.className = "flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all duration-200 text-slate-600 hover:text-slate-900";
        panelWire.classList.remove('hidden');
        panelCharge.classList.add('hidden');
        initWireSimulator();
      }
    }

    function initMomentSimulator() {
      const sliderAngle = document.getElementById('sim3-slider-angle');
      const sliderTurns = document.getElementById('sim3-slider-turns');
      const sliderCurrent = document.getElementById('sim3-slider-current');
      const update = () => {
        const angle = parseFloat(sliderAngle.value);
        const N = parseFloat(sliderTurns.value);
        const I = parseFloat(sliderCurrent.value);
        document.getElementById('lbl-sim3-angle').innerHTML = `$${angle}^\\circ$`;
        document.getElementById('lbl-sim3-turns').innerHTML = `$${N}\\text{ รอบ}$`;
        document.getElementById('lbl-sim3-current').innerHTML = `$${I.toFixed(1)}\\text{ A}$`;
        const A = 10 * 1e-4;
        const B = 5;
        const M = N * I * A * B * Math.cos(angle * Math.PI / 180);
        document.getElementById('lbl-sim3-calc').innerHTML = `$M = ${N} \\times ${I.toFixed(1)} \\times 0.001 \\times 5 \\times \\cos(${angle}^\\circ)$`;
        document.getElementById('lbl-sim3-result').innerHTML = `$${M.toFixed(2)}\\text{ N}\\cdot\\text{m}$`;
        renderMath();
        drawMomentSim(angle, N, I);
      };
      sliderAngle.addEventListener('input', update);
      sliderTurns.addEventListener('input', update);
      sliderCurrent.addEventListener('input', update);
      update();
    }



    function startPracticeMode(topic) {
      currentPracticeTopic = topic;
      document.getElementById('practice-arena').classList.remove('hidden');
      ['15-1', '15-2', '15-3'].forEach(t => {
        const btn = document.getElementById(`btn-prac-${t}`);
        if (btn) {
          if (t === topic) btn.className = "p-4 bg-blue-50 hover:bg-blue-100 text-slate-800 rounded-xl border-2 border-blue-500 flex items-center gap-4 transition text-left";
          else btn.className = "p-4 bg-white hover:bg-slate-50 text-slate-800 rounded-xl border border-slate-200 flex items-center gap-4 transition text-left";
        }
      });
      document.getElementById('prac-feedback').className = "hidden p-5 rounded-2xl border transition-all duration-300";
      document.getElementById('prac-explanation-box').classList.add('hidden');
      regeneratePractice();
    }

    function regeneratePractice() {
      const mode = document.getElementById('prac-type-select').value;
      const isRandom = mode === 'random';
      const formattedTopic = currentPracticeTopic.replace('-', '.');
      const filtered = QUESTION_TEMPLATES.filter(q => q.topic === formattedTopic);
      if (filtered.length === 0) return;
      const template = filtered[Math.floor(Math.random() * filtered.length)];

      // เรียกฟังก์ชันสร้างโจทย์โดยส่ง practiceRNG เข้าไปหากเปิดการสุ่ม เพื่อรับประกันความไม่ซ้ำ
      const rng = isRandom ? practiceRNG : null;
      const instance = generateQuestionInstance(template, rng);

      currentPracticeQuestion = { template, instance };
      document.getElementById('prac-badge-mode').innerText = `หัวข้อ ${formattedTopic} • ` + (isRandom ? 'แบบสุ่มตัวแปร' : 'แบบคู่มือครู สสวท.');
      document.getElementById('prac-question-title').innerText = `📋 โจทย์: ${template.title}`;
      document.getElementById('prac-question-text').innerHTML = template.text(instance.params);
      const choiceZone = document.getElementById('prac-choice-zone');
      const numericZone = document.getElementById('prac-numeric-zone');
      document.getElementById('prac-input-val1').value = '';
      document.getElementById('prac-input-val2').value = '';
      document.getElementById('prac-input-zone-2').classList.add('hidden');
      document.getElementById('prac-feedback').className = "hidden p-5 rounded-2xl border transition-all duration-300";
      document.getElementById('prac-explanation-box').classList.add('hidden');
      if (template.type === 'choice') {
        choiceZone.classList.remove('hidden');
        numericZone.classList.add('hidden');
        choiceZone.innerHTML = '';
        template.choices.forEach((c) => {
          choiceZone.innerHTML += `<button onclick="checkPracticeChoice('${c}')" class="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 text-slate-800 font-medium rounded-xl border border-slate-200 transition">${c}</button>`;
        });
      } else {
        choiceZone.classList.add('hidden');
        numericZone.classList.remove('hidden');
        document.getElementById('lbl-prac-input-1').innerText = template.inputs[0].label;
        if (template.type === 'numeric_double') {
          document.getElementById('prac-input-zone-2').classList.remove('hidden');
          document.getElementById('lbl-prac-input-2').innerText = template.inputs[1].label;
        }
      }
      renderMath();
    }

    function checkPracticeAnswer() {
      if (!currentPracticeQuestion) return;
      const template = currentPracticeQuestion.template;
      const instance = currentPracticeQuestion.instance;
      if (template.type === 'choice') return;
      const v1 = document.getElementById('prac-input-val1').value.trim();
      const v2 = document.getElementById('prac-input-val2').value.trim();
      if (!v1 || (template.type === 'numeric_double' && !v2)) {
        triggerAlert("กรอกข้อมูลไม่ครบ", "กรุณากรอกคำตอบให้ครบทุกช่องก่อนตรวจครับ", "fa-circle-question", "bg-amber-100 text-amber-600");
        return;
      }
      const c1 = isNumericAnswerCorrect(v1, instance.answersRaw[0]);
      const c2 = template.type === 'numeric_double' ? isNumericAnswerCorrect(v2, instance.answersRaw[1]) : true;
      const isCorrect = c1 && c2;
      showPracticeFeedback(isCorrect, instance.explanation());
    }

    function checkPracticeChoice(selectedChoice) {
      if (!currentPracticeQuestion) return;
      const instance = currentPracticeQuestion.instance;
      const isCorrect = selectedChoice === instance.answers[0];
      showPracticeFeedback(isCorrect, instance.explanation());
    }

    // ปรับปรุงฟังก์ชันแสดง feedback ให้นำเสนอข้อมูลที่เข้าใจง่าย
    function showPracticeFeedback(isCorrect, explainText) {
      const feedback = document.getElementById('prac-feedback');
      feedback.className = isCorrect
        ? "p-5 rounded-2xl border bg-emerald-50 border-emerald-100 text-emerald-800 block"
        : "p-5 rounded-2xl border bg-rose-50 border-rose-100 text-rose-800 block";
      feedback.innerHTML = isCorrect
        ? `<div class="flex items-center gap-2 font-bold"><i class="fa-solid fa-circle-check text-emerald-500"></i> ตอบถูกตามหลักเกณฑ์ฟิสิกส์!</div>`
        : `<div class="flex items-center gap-2 font-bold"><i class="fa-solid fa-circle-xmark text-rose-500"></i> คำตอบยังไม่ถูกครับ ลองเช็ควิธีคำนวณด้านล่างนี้</div>`;
      document.getElementById('prac-explanation-text').innerHTML = explainText;
      document.getElementById('prac-explanation-box').classList.remove('hidden');
      renderMath();
    }

    function startExamProcess() {
      const name = document.getElementById('exam-student-name').value.trim();
      const cls = document.getElementById('exam-student-class').value.trim();
      const num = document.getElementById('exam-student-no').value.trim();
      if (!name || !cls || !num) {
        triggerAlert("กรอกข้อมูลไม่ครบ", "กรุณากรอกชื่อ ชั้นเรียน และเลขที่ผู้เรียนให้ครบถ้วนก่อนจะเริ่มทำข้อสอบครับ", "fa-user-clock", "bg-indigo-100 text-indigo-600");
        return;
      }
      examStudentInfo = { name, class: cls, number: num };

      // สร้างตัวแปรการสุ่มแบบ Seeded RNG โดยใช้เลขที่ผู้เรียนร่วมกับข้อมูลเวลาและตัวเลขสุ่ม
      // เพื่อให้การสอบแต่ละครั้งของเลขที่เดิมสุ่มได้ชุดคำถามและค่าพารามิเตอร์ที่ไม่ซ้ำกัน
      const randomSeed = `${num}_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
      const examRNG = new SeededRNG(randomSeed);

      // คัดกรองและสุ่มแยกประเภท: ตัวเลือก 1 ข้อ และ คำนวณ 4 ข้อ (ครอบคลุม 15.1, 15.2, 15.3)
      const choicePool = QUESTION_TEMPLATES.filter(q => q.type === 'choice');
      const numericPool = QUESTION_TEMPLATES.filter(q => q.type !== 'choice');

      const shuffledChoices = examRNG.shuffle(choicePool);
      const selectedChoice = shuffledChoices[0];

      const num15_1 = numericPool.filter(q => q.topic === '15.1');
      const num15_2 = numericPool.filter(q => q.topic === '15.2');
      const num15_3 = numericPool.filter(q => q.topic === '15.3');

      const shuf15_1 = examRNG.shuffle(num15_1);
      const shuf15_2 = examRNG.shuffle(num15_2);
      const shuf15_3 = examRNG.shuffle(num15_3);

      const q1 = shuf15_1[0];
      const q2 = shuf15_2[0];
      const q3 = shuf15_3[0];

      // ข้อคำนวณที่ 4 สุ่มจากข้อคำนวณที่เหลืออยู่ทั้งหมด
      const remainingNumerics = numericPool.filter(q => q.id !== q1.id && q.id !== q2.id && q.id !== q3.id);
      const shufRemaining = examRNG.shuffle(remainingNumerics);
      const q4 = shufRemaining[0];

      // รวมข้อสอบทั้งหมด 5 ข้อ และสลับลำดับข้ออีกครั้งเพื่อให้ตัวเลือกกระจายตัวแบบสุ่ม
      const selectedTemplates = examRNG.shuffle([selectedChoice, q1, q2, q3, q4]);
      const generatedQuestions = selectedTemplates.map((template) => {
        // ใช้ฟังก์ชันตัวช่วยสุ่มโจทย์แบบไม่ซ้ำ โดยส่งตัวสุ่มแบบ Seeded RNG เข้าไป
        const instance = generateQuestionInstance(template, examRNG);
        return {
          id: template.id, topic: template.topic, type: template.type, title: template.title,
          text: template.text(instance.params), inputs: template.inputs || [], choices: template.choices || [],
          answers: instance.answers, answersRaw: instance.answersRaw, explanationText: instance.explanation()
        };
      });
      document.getElementById('lbl-exam-user-info').innerText = `${name} (ม.6/${cls} เลขที่ ${num})`;
      currentExamQuestions = generatedQuestions;
      renderExamLiveDOM();
      initializeExamSession(currentExamQuestions, examStudentInfo);
      showSection('exam-live');
    }

    function renderExamLiveDOM() {
      const container = document.getElementById('exam-questions-container');
      container.innerHTML = '';
      currentExamQuestions.forEach((q, idx) => {
        let inputHTML = '';
        if (q.type === 'choice') {
          inputHTML += `<div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">`;
          q.choices.forEach((c, cIdx) => {
            inputHTML += `<label class="flex items-center gap-3 bg-slate-50 border border-slate-200 hover:bg-slate-100 p-3.5 rounded-xl transition duration-100 cursor-pointer">
          <input type="radio" name="exam-q${idx}" id="exam-q${idx}-opt${cIdx}" value="${c}" class="w-4 h-4 text-violet-600 focus:ring-violet-500">
          <span class="text-sm text-slate-800 font-medium">${c}</span>
        </label>`;
          });
          inputHTML += `</div>`;
        } else if (q.type === 'numeric_single') {
          inputHTML += `<div class="grid grid-cols-1 gap-4 pt-2">
        <div>
          <label class="block text-xs font-semibold text-slate-500 mb-1">${q.inputs[0].label}</label>
          <input type="text" autocomplete="off" id="exam-q${idx}-val1" placeholder="เช่น 2.0 หรือ 2.0e-3" class="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm">
        </div>
      </div>`;
        } else if (q.type === 'numeric_double') {
          inputHTML += `<div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        <div>
          <label class="block text-xs font-semibold text-slate-500 mb-1">${q.inputs[0].label}</label>
          <input type="text" autocomplete="off" id="exam-q${idx}-val1" placeholder="ระบุคำตอบแรก" class="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm">
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 mb-1">${q.inputs[1].label}</label>
          <input type="text" autocomplete="off" id="exam-q${idx}-val2" placeholder="ระบุคำตอบที่สอง" class="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm">
        </div>
      </div>`;
        }
        container.innerHTML += `<div class="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
      <div class="flex items-center justify-between border-b border-slate-100 pb-2">
        <span class="text-sm font-bold text-slate-800">📝 ข้อที่ ${idx + 1}: ${q.title}</span>
        <span class="bg-violet-100 text-violet-800 px-2.5 py-0.5 rounded text-xs font-semibold">2 คะแนน</span>
      </div>
      <p class="text-sm md:text-base text-slate-700 leading-relaxed font-medium">${q.text}</p>
      ${inputHTML}
    </div>`;
      });
      renderMath();
    }

    function confirmSubmitExam() {
      const answers = getCurrentExamAnswers();
      const uncomplete = answers.some(a => a === null || a === '' || (Array.isArray(a) && a.some(v => v.trim() === '')));
      const msg = uncomplete ? "คุณยังตอบข้อสอบไม่ครบถ้วน ยืนยันที่จะส่งหรือไม่?" : "ยืนยันต้องการที่จะส่งข้อสอบหรือไม่?";
      examConfirmingSubmit = true;
      if (confirm(msg)) {
        submitExam();
      } else {
        setTimeout(() => {
          examConfirmingSubmit = false;
        }, 300);
      }
    }

    function submitExam(timeExpired = false) {
      if (examSubmissionInProgress) return;
      examSubmissionInProgress = true;
      clearInterval(examTimerInterval);
      if (!currentExamQuestions.length) {
        endExamSession();
        triggerAlert("ไม่พบกระดาษคำตอบ", "ระบบไม่พบข้อมูลข้อสอบ กรุณาทำสอบใหม่อีกครั้งครับ", "fa-triangle-exclamation", "bg-rose-100 text-rose-600");
        showSection('exam-start');
        return;
      }
      const answers = getCurrentExamAnswers();
      let total_score = 0;
      const gradedResults = [];
      currentExamQuestions.forEach((q, idx) => {
        let isCorrect = false;
        const userAns = answers[idx];
        if (q.type === 'choice') isCorrect = userAns === q.answers[0];
        else if (q.type === 'numeric_single') isCorrect = userAns && isNumericAnswerCorrect(userAns[0], q.answersRaw[0]);
        else if (q.type === 'numeric_double') isCorrect = userAns && isNumericAnswerCorrect(userAns[0], q.answersRaw[0]) && isNumericAnswerCorrect(userAns[1], q.answersRaw[1]);
        const score = isCorrect ? 2.0 : 0.0;
        total_score += score;
        gradedResults.push({ idx, isCorrect, score, userAns });
      });
      examTimeRemaining = Math.max(0, getCurrentExamRemainingSeconds());
      const elapsed = timeExpired ? EXAM_DURATION_SECONDS : (EXAM_DURATION_SECONDS - examTimeRemaining);
      const m = Math.floor(elapsed / 60), s = elapsed % 60;
      const time_taken_str = `${m} นาที ${s} วินาที`;
      const finishedAt = new Date();
      const finishedAtDisplay = formatThaiDateTimeBuddhistEra(finishedAt);
      const savePayload = {
        score: total_score, timeTaken: time_taken_str, finishedAtDisplay, studentInfo: examStudentInfo,
        examQuestions: currentExamQuestions, gradedResults: gradedResults, date: finishedAt.toLocaleDateString('th-TH-u-ca-buddhist'),
        focusLossCount: examFocusLossCount
      };
      localStorage.setItem('last_exam_results', JSON.stringify(savePayload));
      const lastFocusLoss = examFocusLossCount;
      endExamSession();
      showSection('exam-result');
      displayExamResults(total_score, gradedResults, time_taken_str, examStudentInfo, finishedAtDisplay, lastFocusLoss);
      updateLatestScoreOnHome();
    }

    function displayExamResults(score, gradedResults, timeTaken, studentInfo, finishedAtDisplay = '-', focusLoss = 0) {
      document.getElementById('lbl-res-student-name').innerText = studentInfo.name;
      document.getElementById('lbl-res-student-meta').innerText = `ชั้น ม.6/${studentInfo.class} เลขที่ ${studentInfo.number}`;
      document.getElementById('lbl-res-time-elapsed').innerText = `ใช้เวลาไปทั้งหมด: ${timeTaken}`;
      document.getElementById('lbl-res-finished-at').innerText = `ส่งข้อสอบเมื่อ: ${finishedAtDisplay}`;
      
      const focusLossEl = document.getElementById('lbl-res-focus-loss');
      if (focusLossEl) {
        let ratingText = '';
        if (focusLoss <= 1) {
          ratingText = `<span class="text-emerald-600 font-bold">ดีเยี่ยม (สลับหน้าจอ ${focusLoss} ครั้ง)</span>`;
        } else if (focusLoss <= 3) {
          ratingText = `<span class="text-amber-600 font-bold">ควรระวัง (สลับหน้าจอ ${focusLoss} ครั้ง)</span>`;
        } else {
          ratingText = `<span class="text-rose-600 font-bold">น่าสงสัย (สลับหน้าจอ ${focusLoss} ครั้ง)</span>`;
        }
        focusLossEl.innerHTML = `ความน่าเชื่อถือ: ${ratingText}`;
      }
      const percent = (score / 10) * 100;
      const circle = document.getElementById('res-circle-progress');
      const offset = 314 - (percent / 100) * 314;
      circle.style.strokeDashoffset = offset;
      document.getElementById('lbl-res-total-score').innerText = score;
      const tbody = document.getElementById('exam-result-tbody');
      tbody.innerHTML = '';
      const solutionsContainer = document.getElementById('exam-solutions-container');
      solutionsContainer.innerHTML = '';
      currentExamQuestions.forEach((q, idx) => {
        const grad = gradedResults[idx];
        const statusBadge = grad.isCorrect
          ? `<span class="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded-full"><i class="fa-solid fa-circle-check"></i> ถูก</span>`
          : `<span class="bg-rose-100 text-rose-800 text-xs font-semibold px-2.5 py-0.5 rounded-full"><i class="fa-solid fa-circle-xmark"></i> ผิด</span>`;
        tbody.innerHTML += `<tr>
      <td class="px-4 py-3 font-semibold text-slate-900">${idx + 1}</td>
      <td class="px-4 py-3">${q.title} (หัวข้อ ${q.topic})</td>
      <td class="px-4 py-3 text-center font-bold">2.0</td>
      <td class="px-4 py-3 text-center font-bold text-indigo-600">${grad.score.toFixed(1)}</td>
      <td class="px-4 py-3 text-center">${statusBadge}</td>
    </tr>`;
        let userAnsText = '';
        if (q.type === 'choice') userAnsText = grad.userAns || 'ไม่ได้ระบุ';
        else if (q.type === 'numeric_single') userAnsText = grad.userAns ? grad.userAns[0] : 'ไม่ได้ระบุ';
        else if (q.type === 'numeric_double') userAnsText = grad.userAns ? `${grad.userAns[0]} และ ${grad.userAns[1]}` : 'ไม่ได้ระบุ';
        solutionsContainer.innerHTML += `<div class="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
      <h4 class="font-bold text-slate-900 text-base">🔑 เฉลยข้อที่ ${idx + 1}: ${q.title}</h4>
      <p class="text-xs text-slate-500 font-medium">โจทย์: ${q.text}</p>
      <div class="text-xs bg-white border border-slate-200 p-2.5 rounded-lg">
        <span>คำตอบที่คุณส่ง: <strong class="${grad.isCorrect ? 'text-emerald-600' : 'text-rose-600'}">${userAnsText}</strong></span>
        <br><span>คำตอบที่ถูกต้อง: <strong>${q.answers.join(' และ ')}</strong></span>
      </div>
      <div class="bg-white p-4 rounded-xl border border-slate-200 text-xs md:text-sm text-slate-700 space-y-3 math-font">${q.explanationText}</div>
    </div>`;
      });
      const feedback = document.getElementById('lbl-res-badge-feedback');
      if (score === 10) {
        feedback.className = "text-xs bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-200 font-semibold leading-relaxed block";
        feedback.innerHTML = `🌟 <strong>ยอดเยี่ยมระดับเหรียญทอง!</strong> คุณสอบได้คะแนนเต็ม ตอบถูกสมบูรณ์แบบทั้งทฤษฎีและคำนวณเก่งมากครับ`;
      } else if (score >= 6) {
        feedback.className = "text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-100 font-semibold leading-relaxed block";
        feedback.innerHTML = `👍 <strong>ดีมาก!</strong> สอบผ่านผ่านเกณฑ์ขั้นต่ำ ควรทบทวนเฉลยแยกรายข้อที่ยังตอบผิดเพื่อให้เกิดความรอบคอบเพิ่มขึ้นครับ`;
      } else {
        feedback.className = "text-xs bg-rose-50 text-rose-700 px-3 py-1.5 rounded-lg border border-rose-100 font-semibold leading-relaxed block";
        feedback.innerHTML = `📚 <strong>ควรกลับไปศึกษาเพิ่ม!</strong> คะแนนสอบยังต่ำกว่าเกณฑ์ ขอแนะนำให้กลับไปทบทวนในส่วน Review และฝีกโจทย์ใหม่บ่อยๆ นะครับ`;
      }
      renderMath();
    }

    function toggleExamSolutionBox() {
      const box = document.getElementById('exam-solution-box');
      const text = document.getElementById('lbl-toggle-solution-text');
      if (box.classList.contains('hidden')) {
        box.classList.remove('hidden');
        text.innerText = "ซ่อนเฉลยละเอียดของข้อสอบ";
      } else {
        box.classList.add('hidden');
        text.innerText = "ดูเฉลยละเอียดของข้อที่คุณได้รับ";
      }
    }


