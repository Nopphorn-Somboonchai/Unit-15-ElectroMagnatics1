// Math & Formatting Utilities
    function roundHalfEven(num, decimalPlaces = 0) {
      if (!Number.isFinite(num)) return num;
      const factor = Math.pow(10, decimalPlaces);
      const sign = Math.sign(num) || 1;
      const scaled = Math.abs(num) * factor;
      const floor = Math.floor(scaled);
      const fraction = scaled - floor;
      const epsilon = 1e-10;
      let roundedInteger;
      if (fraction > 0.5 + epsilon) roundedInteger = floor + 1;
      else if (fraction < 0.5 - epsilon) roundedInteger = floor;
      else roundedInteger = floor % 2 === 0 ? floor : floor + 1;
      const rounded = sign * roundedInteger / factor;
      return decimalPlaces > 0 ? Number(rounded.toFixed(decimalPlaces)) : rounded;
    }

    function formatHalfEven(num, decimalPlaces = 0) {
      return roundHalfEven(num, decimalPlaces).toFixed(decimalPlaces);
    }

    function formatSci(num, sigFigs = 2) {
      if (num === 0) return "0";
      const absNum = Math.abs(num);
      if (absNum >= 0.01 && absNum < 1000) {
        if (absNum === Math.round(absNum)) return num.toString();
        let dp = 2;
        if (absNum >= 100) dp = 1;
        if (absNum < 1) dp = 3;
        return roundHalfEven(num, dp).toString();
      }
      const exp = num.toExponential(sigFigs - 1);
      const parts = exp.split('e');
      const base = parts[0];
      const power = parseInt(parts[1]);
      return `${base} \\times 10^{${power}}`;
    }

    function cleanAndParseNumber(str) {
      let clean = str.trim().toLowerCase()
        .replace(/\\times/g, 'e')
        .replace(/x/g, 'e')
        .replace(/\*/g, 'e')
        .replace(/10\^/g, '')
        .replace(/\{/g, '')
        .replace(/\}/g, '')
        .replace(/\s+/g, '');
      if (clean.includes('e-')) {
        const parts = clean.split('e-');
        return parseFloat(parts[0]) * Math.pow(10, -parseFloat(parts[1]));
      }
      if (clean.includes('e')) {
        const parts = clean.split('e');
        return parseFloat(parts[0]) * Math.pow(10, parseFloat(parts[1]));
      }
      return parseFloat(clean);
    }

    function isNumericAnswerCorrect(userStr, targetNum) {
      if (!userStr) return false;
      const parsedUser = cleanAndParseNumber(userStr);
      if (isNaN(parsedUser)) return false;
      if (Math.abs(targetNum) < 1e-9) return Math.abs(parsedUser) < 1e-9;
      const diff = Math.abs(parsedUser - targetNum) / Math.abs(targetNum);
      return diff < 0.05;
    }

    function formatExamTime(seconds) {
      const safeSeconds = Math.max(0, Math.floor(seconds));
      const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, '0');
      const remainingSeconds = (safeSeconds % 60).toString().padStart(2, '0');
      return `${minutes}:${remainingSeconds}`;
    }

    function formatThaiDateTimeBuddhistEra(date = new Date()) {
      return new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).format(date);
    }


// RNG & Seeded RNG Utilities
    // ============================================================================
    // [ปรับปรุง] ส่วนของการจัดการสุ่มแบบจำประวัติไม่ซ้ำ (Unique Random) และการสุ่มแบบใช้ Seed ตามเลขที่ผู้เรียน
    // ============================================================================

    // คลาสจัดการการสุ่มแบบปกติ (Math.random) ที่มีการเก็บประวัติเพื่อป้องกันตัวเลขสุ่มซ้ำในการสร้างโจทย์แต่ละครั้ง
    class NormalRNG {
      constructor() {
        this.history = {}; // เก็บชุดข้อมูลของพารามิเตอร์ที่สุ่มไปแล้ว แยกตาม ID ของโจทย์เพื่อป้องกันไม่ให้เจอปุ่มเดิมซ้ำๆ
      }

      random() {
        return Math.random();
      }

      choice(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
      }

      // ตรวจสอบว่าพารามิเตอร์ชุดนี้เคยสุ่มเจอแล้วหรือไม่
      hasGenerated(id, paramStr) {
        return this.history[id] && this.history[id].includes(paramStr);
      }

      // บันทึกประวัติการสุ่ม
      recordGeneration(id, paramStr, limit = 10) {
        if (!this.history[id]) {
          this.history[id] = [];
        }
        this.history[id].push(paramStr);
        if (this.history[id].length > limit) {
          this.history[id].shift(); // ลบข้อมูลสุ่มที่เก่าที่สุดออก
        }
      }
    }

    // คลาสจัดการการสุ่มแบบกำหนดค่าเริ่มต้น (Seeded Random Number Generator) ตามเลขที่ผู้เรียน
    class SeededRNG {
      constructor(seedStr) {
        let hash = 0;
        for (let i = 0; i < seedStr.length; i++) {
          hash = (hash * 31 + seedStr.charCodeAt(i)) | 0;
        }
        this.seed = hash;
        if (this.seed === 0) this.seed = 1; // หลีกเลี่ยงค่า seed เป็น 0
        this.history = {}; // สำหรับการทำสุ่มแบบไม่ซ้ำภายใน session นี้
      }

      // อัลกอริทึม Mulberry32 สำหรับใช้ในการสุ่มแบบ Seeded
      random() {
        let t = this.seed += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      }

      choice(arr) {
        return arr[Math.floor(this.random() * arr.length)];
      }

      // สลับลำดับสมาชิกในอาเรย์อย่างสม่ำเสมอตาม Seed
      shuffle(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(this.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      }

      hasGenerated(id, paramStr) {
        return this.history[id] && this.history[id].includes(paramStr);
      }

      recordGeneration(id, paramStr, limit = 10) {
        if (!this.history[id]) {
          this.history[id] = [];
        }
        this.history[id].push(paramStr);
        if (this.history[id].length > limit) {
          this.history[id].shift();
        }
      }
    }

    // สร้างอ็อบเจ็กต์สุ่มปกติสำหรับโหมดฝึกฝน (Practice)
    const practiceRNG = new NormalRNG();

    // ฟังก์ชันตัวช่วยในการสร้างโจทย์และรับประกันความไม่ซ้ำกันของตัวสุ่มพารามิเตอร์
    function generateQuestionInstance(template, rng) {
      if (!rng) return template.generate(null); // กรณีใช้คู่มือครู (สุ่มธรรมดาแบบกำหนดค่าคงที่)
      let instance;
      let attempts = 0;
      const maxAttempts = 100;

      while (attempts < maxAttempts) {
        instance = template.generate(rng);
        const paramStr = JSON.stringify(instance.params);

        // ถ้ายังไม่เคยถูกสร้าง ให้บันทึกลงประวัติและส่งผลลัพธ์กลับทันที
        if (!rng.hasGenerated(template.id, paramStr)) {
          rng.recordGeneration(template.id, paramStr, 15);
          break;
        }
        attempts++;
      }
      return instance;
    }
