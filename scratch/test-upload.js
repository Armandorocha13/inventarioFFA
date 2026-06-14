const fs = require('fs');

async function testUpload() {
  const filePath = 'c:\\Users\\user\\Desktop\\ARQUVOS\\PPROJETOS PROGRAMAÇÃO\\sistemaInventario\\docs\\planilhas\\Saldo Estoque.xlsx';
  if (!fs.existsSync(filePath)) {
    console.error("Planilha de teste não encontrada!");
    return;
  }

  console.log("Preparando arquivo para upload...");
  const fileBuffer = fs.readFileSync(filePath);
  const fileBlob = new Blob([fileBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  const formData = new FormData();
  formData.append('file', fileBlob, 'Saldo Estoque.xlsx');

  console.log("Enviando requisição POST para /api/upload-saldo...");
  try {
    const res = await fetch('http://localhost:3000/api/upload-saldo', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    console.log("Resposta do Servidor:");
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Erro na requisição:", e);
  }
}

testUpload();
