const fs = require('fs');
const XLSX = require('xlsx');

function run() {
  const filePath = 'c:\\Users\\user\\Desktop\\ARQUVOS\\PPROJETOS PROGRAMAÇÃO\\sistemaInventario\\docs\\planilhas\\Saldo Estoque.xlsx';
  if (!fs.existsSync(filePath)) {
    console.error("File does not exist: " + filePath);
    return;
  }
  
  const workbook = XLSX.readFile(filePath);
  console.log("Sheet names:", workbook.SheetNames);
  
  // Read first sheet
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  // Convert only headers and first few rows to limit memory
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  range.s.r = 0;
  range.e.r = 5; // read first 5 rows
  worksheet['!ref'] = XLSX.utils.encode_range(range);
  
  const data = XLSX.utils.sheet_to_json(worksheet);
  console.log("=== First 5 rows headers/sample ===");
  console.log(JSON.stringify(data, null, 2));
}

run();
