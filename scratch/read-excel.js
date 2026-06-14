const fs = require('fs');
const { execSync } = require('child_process');

// Install xlsx package temporarily if not present
try {
  require.resolve('xlsx');
} catch (e) {
  console.log("Installing 'xlsx' library...");
  execSync('npm install xlsx', { stdio: 'inherit' });
}

const XLSX = require('xlsx');

function run() {
  const filePath = 'c:\\Users\\user\\Desktop\\ARQUVOS\\PPROJETOS PROGRAMAÇÃO\\sistemaInventario\\listagem.xlsx';
  if (!fs.existsSync(filePath)) {
    console.error("File does not exist: " + filePath);
    return;
  }
  
  const workbook = XLSX.readFile(filePath);
  console.log("Sheet names:", workbook.SheetNames);
  
  // Read first sheet
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  const data = XLSX.utils.sheet_to_json(worksheet);
  console.log(`Total rows read: ${data.length}`);
  
  // Print first 20 rows
  console.log("=== First 20 Rows ===");
  console.log(JSON.stringify(data.slice(0, 50), null, 2));
}

run();
