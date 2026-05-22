const express = require("express");
const axios = require("axios");
const cors = require("cors");

require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const API_ID = process.env.WOOVI_API_ID;

app.post("/criar-pix", async (req, res) => {

  console.log(req.body);

  console.log("ROTA /criar-pix CHAMADA");

  try {

    const { amount } = req.body;

    const response = await axios.post(
      "https://api.woovi.com/api/v1/charge",
      {
        correlationID: "cantb_" + Date.now(),

        value: Number(amount) / 100,

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