const nomesMasculinos = [
  "Lucas",
  "Pedro",
  "Mateus",
  "João",
  "Gabriel",
  "Rafael",
  "Gustavo",
  "Felipe",
  "Bruno",
  "Thiago",
  "Marcos",
  "André",
  "Daniel",
  "Vinicius",
  "Carlos",
  "Fernando",
  "Ricardo",
  "Eduardo",
  "Leandro",
  "Caio",
  "Murilo",
  "Diego",
  "Leonardo",
  "Paulo",
  "Henrique"
];

const nomesFemininos = [
  "Maria",
  "Ana",
  "Juliana",
  "Fernanda",
  "Patricia",
  "Amanda",
  "Camila",
  "Larissa",
  "Beatriz",
  "Gabriela",
  "Mariana",
  "Aline",
  "Vanessa",
  "Jessica",
  "Renata",
  "Bianca",
  "Bruna",
  "Tatiane",
  "Natália",
  "Carolina",
  "Isabela",
  "Elaine",
  "Vitória",
  "Sabrina",
  "Letícia"
];

const sobrenomes = [
  "Silva",
  "Souza",
  "Oliveira",
  "Santos",
  "Lima",
  "Costa",
  "Ferreira",
  "Rodrigues",
  "Almeida",
  "Nascimento",
  "Barbosa",
  "Gomes",
  "Martins",
  "Rocha",
  "Ribeiro",
  "Alves",
  "Monteiro",
  "Cardoso",
  "Correia",
  "Teixeira"
];

function gerarNome() {

  const usarFeminino =
    Math.random() < 0.5;

  const lista =
    usarFeminino
      ? nomesFemininos
      : nomesMasculinos;

  const nome =
    lista[Math.floor(Math.random() * lista.length)];

  const sobrenome =
    sobrenomes[Math.floor(Math.random() * sobrenomes.length)];

  return nome + " " + sobrenome;
}
function gerarCPF() {

  let cpf = '';

  for (let i = 0; i < 9; i++) {
    cpf += Math.floor(Math.random() * 10);
  }

  let soma = 0;

  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpf.charAt(i)) * (10 - i);
  }

  let resto = 11 - (soma % 11);

  let dig1 =
    resto >= 10 ? 0 : resto;

  cpf += dig1;

  soma = 0;

  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpf.charAt(i)) * (11 - i);
  }

  resto = 11 - (soma % 11);

  let dig2 =
    resto >= 10 ? 0 : resto;

  cpf += dig2;

  return cpf;
}
const express = require("express");
const axios = require("axios");
const cors = require("cors");

require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const API_ID = process.env.WOOVI_API_ID;

app.post("/criar-pix", async (req, res) => {

  console.log("ROTA /criar-pix CHAMADA");

  try {

    const { nome, valor } = req.body;

    const response = await axios.post(
      "https://api.woovi.com/api/v1/charge",
      {
        correlationID: "cantb_" + Date.now(),

        value: Number(valor) * 100,

        comment: "cantb",

        customer: {
  name: gerarNome(),
  email: "doacao@site.com",
  phone: "11999999999",
  taxID: gerarCPF()
}
      },
      {
  headers: {
  "Content-Type": "application/json",
  Authorization: API_ID
}
}
    );

    console.log(response.data);

    const charge =
      response.data.charge ||
      response.data.charges?.[0];

    res.json({
  paymentId: charge.correlationID,
  qrCode: charge.brCode,
  brCode: charge.brCode,
  qrCodeImage: charge.qrCodeImage,
  amount: charge.value
});

  } catch (error) {

    console.log(
      error.response?.data ||
      error.message
    );

    res.status(500).json({
      erro: "Erro ao gerar PIX"
    });
  }
});

app.get("/", (req, res) => {
  res.send("Backend online");
});

app.get("/consultar-pix", async (req, res) => {

  try {

    const id = req.query.id;

    const response = await axios.get(
      `https://api.woovi.com/api/v1/charge/${id}`,
      {
        headers: {
          Authorization: API_ID
        }
      }
    );

    const charge = response.data;

    res.json({
      success: true,
      isPaid: charge.status === "COMPLETED"
    });

  } catch (e) {

    console.log(e.response?.data || e.message);

    res.json({
      success: false
    });
  }
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});