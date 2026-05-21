const SPREADSHEET_ID = '1_NQge4YWzz8ijn-YVTGF9hTnJtHVSCSyYK3srXeTASY';
const BASE_URL = 'https://docs.google.com/spreadsheets/d';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') { inQuote = false; }
      else { cell += ch; }
    } else {
      if (ch === '"') { inQuote = true; }
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (ch === '\r') { /* skip */ }
      else { cell += ch; }
    }
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

async function fetchSheetList() {
  const url = `${BASE_URL}/${SPREADSHEET_ID}/htmlview`;
  const res = await fetch(url);
  const html = await res.text();

  const regex = /items\.push\(\s*({[^}]+})\s*\)/g;
  const sheets = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const objText = match[1];
      const nameMatch = /name:\s*"([^"]+)"/.exec(objText);
      const gidMatch = /gid:\s*"([^"]+)"/.exec(objText);
      if (nameMatch && gidMatch) {
        const name = nameMatch[1];
        const gid = gidMatch[1];
        if (/^[BM]\d/.test(name)) {
          sheets.push({ name, gid });
        }
      }
    } catch (e) {}
  }
  return sheets;
}

async function inspectMemberSheet(name, gid) {
  const url = `${BASE_URL}/${SPREADSHEET_ID}/export?format=csv&gid=${gid}`;
  const res = await fetch(url);
  const text = await res.text();
  const rows = parseCsv(text);

  console.log(`\n=== Member Sheet: ${name} (GID: ${gid}) ===`);
  console.log(`Total rows: ${rows.length}`);
  
  // Show first 15 rows to see structure
  console.log("First 15 rows of CSV:");
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    console.log(`Row ${i}:`, rows[i].slice(0, 8));
  }

  // Find header
  const headerIdx = rows.slice(0, 15).findIndex(r => r.some(cell => cell.includes('低強度')));
  console.log(`Header index containing "低強度": ${headerIdx}`);
  if (headerIdx !== -1) {
    console.log("Header columns:", rows[headerIdx]);
    
    // Sample some data rows below header
    const dataRows = rows.slice(headerIdx + 1);
    console.log(`Data rows count: ${dataRows.length}`);
    
    // Find column indexes
    const header = rows[headerIdx];
    const jogCol = header.findIndex(cell => cell.includes('低強度'));
    const mltCol = header.findIndex(cell => cell.includes('中強度'));
    const cvCol = header.findIndex(cell => cell.includes('高強度'));
    const speedCol = header.findIndex(cell => cell.includes('解糖系'));
    // 「実際の距離」または「距離」を検索
    const totalCol = header.findIndex(cell => cell.includes('実際の距離') || cell.trim() === '距離');
    
    console.log(`Col indexes - total:${totalCol}, jog:${jogCol}, mlt:${mltCol}, cv:${cvCol}, speed:${speedCol}`);

    const parseValDebug = (val) => {
      if (!val) return 0;
      // 全角数字を半角に変換する
      let cleanVal = val.trim().replace(/[０-９．]/g, (s) => {
        if (s === '．') return '.';
        return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
      });
      cleanVal = cleanVal.replace(/[^\d.]/g, '');
      const num = parseFloat(cleanVal);
      return isNaN(num) ? 0 : num;
    };

    for (let j = 0; j < dataRows.length; j++) {
      const r = dataRows[j];
      const dateRaw = r[0]?.trim();
      if (!dateRaw) continue;
      
      const isDateValid = /^\d{1,2}\/\d{1,2}/.test(dateRaw);
      if (!isDateValid) continue;
      
      const totalRaw = r[totalCol] ?? '';
      const jogRaw = jogCol !== -1 ? r[jogCol] : '';
      const mltRaw = mltCol !== -1 ? r[mltCol] : '';
      const cvRaw = cvCol !== -1 ? r[cvCol] : '';
      const speedRaw = speedCol !== -1 ? r[speedCol] : '';
      
      let totalNum = parseValDebug(totalRaw);
      let jogNum = parseValDebug(jogRaw);
      const mltNum = parseValDebug(mltRaw);
      const cvNum = parseValDebug(cvRaw);
      const speedNum = parseValDebug(speedRaw);
      
      // 合計が強度の合計より大きい場合、差分をjogに加算する
      const sumIntensities = jogNum + mltNum + cvNum + speedNum;
      if (totalNum > sumIntensities) {
        jogNum = jogNum + (totalNum - sumIntensities);
      } else if (totalNum === 0 && sumIntensities > 0) {
        totalNum = sumIntensities;
      }
      
      if (totalNum > 0) {
        console.log(`Parsed Date: ${dateRaw} | Total: ${totalNum} | Jog: ${jogNum} | Mlt: ${mltNum} | Cv: ${cvNum} | Speed: ${speedNum}`);
      }
    }
  }
}

async function run() {
  try {
    const list = await fetchSheetList();
    console.log("Sheet list:", list);
    for (const member of list) {
      await inspectMemberSheet(member.name, member.gid);
    }
  } catch (e) {
    console.error(e);
  }
}

run();
