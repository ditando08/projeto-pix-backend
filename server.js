const express = require("express");
const axios = require("axios");
const cors = require("cors");

require("dotenv").config();
console.log("ENV KEYS:", Object.keys(process.env));

console.log("SUPABASE_URL =", process.env.SUPABASE_URL);
console.log("SUPABASE_KEY =", process.env.SUPABASE_KEY ? "OK" : "MISSING");
console.log("WOOVI_API_ID =", process.env.WOOVI_API_ID ? "OK" : "MISSING");
const { createClient } =
require("@supabase/supabase-js");

let supabase = null;

if (
  process.env.SUPABASE_URL &&
  process.env.SUPABASE_KEY
) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );
}

const app = express();

app.use(cors());
app.use(express.json());

const API_ID = process.env.WOOVI_API_ID;

app.post("/criar-pix", async (req, res) => {

  console.log(req.body);
  console.log("TRACKING:", req.body);

  console.log("ROTA /criar-pix CHAMADA");

  try {

    const {
  amount,
  gclid,
  acc,
  camp,
  mail
} = req.body;

if (gclid || acc || camp || mail) {
  console.log("TRACKING OK");
}

console.log("TRACKING:", {
  gclid,
  acc,
  camp,
  mail
});

    const response = await axios.post(
      "https://api.woovi.com/api/v1/charge",
      {
        correlationID: "cantb_" + Date.now(),

        value: Number(amount),

        comment: "Doacao Site",

        customer: {
  name: "Doador",
  email: "doacao@site.com",
  phone: "11999999999",
  taxID: "11144477735"
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

    console.log("WOOVI RESPONSE:", response.data);

const charge =
  response.data?.charge ||
  response.data?.charges?.[0] ||
  response.data;

try {

  try {

  if (supabase) {

    const { data, error } = await supabase
      .from("pix_pagamentos")
      .insert({
        paymentid: charge.correlationID,
        gclid: gclid || "",
        acc: acc || "",
        camp: camp || "",
        mail: mail || "",
        valor: charge.value,
        status: "pendente"
      });

    console.log("SUPABASE DATA:", data);
    console.log("SUPABASE ERROR:", error);

  }   // <- fecha o if

} catch (e) {

  console.log(
    "ERRO SUPABASE COMPLETO:",
    e
  );

}

console.log("CHARGE FINAL:", charge);

res.json({
  paymentId:
    charge.correlationID ||
    charge._id ||
    "",

  qrCode:
    charge.brCode || "",

  brCode:
    charge.brCode || "",

  qrCodeImage:
    charge.qrCodeImage || "",

  amount:
    charge.value || 0
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