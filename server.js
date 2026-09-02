const express = require("express");
const axios = require("axios");
const cors = require("cors");

require("dotenv").config();
const { createClient } =
require("@supabase/supabase-js");

const supabase =
createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

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

      await supabase
        .from("pix_pagamentos")
        .insert({
          paymentid:
            charge.correlationID,

          gclid:
            gclid || "",

          acc:
            acc || "",

          camp:
            camp || "",

          mail:
            mail || "",

          valor:
            charge.value,

          status:
            "pendente"
        });

      console.log(
        "PIX SALVO NO SUPABASE"
      );

    } catch (e) {

      console.log(
        "ERRO SUPABASE:",
        e.message
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


/*
 * PIX AUTOMÁTICO — rota separada.
 * Não altera /criar-pix nem /consultar-pix, portanto o Pix único continua
 * exatamente no fluxo anterior.
 */
app.post("/criar-pix-automatico", async (req, res) => {
  console.log("ROTA /criar-pix-automatico CHAMADA");

  try {
    const {
      amount_cents,
      name,
      cpf,
      lead_id,
      correlation_id,
      campaign,
      contract,
    } = req.body || {};

    const value = Number(amount_cents);
    const cleanCpf = String(cpf || "").replace(/\D/g, "");
    const cleanName = String(name || "").trim();

    if (!Number.isInteger(value) || value <= 0) {
      return res.status(400).json({
        success: false,
        erro: "Valor da doação inválido"
      });
    }

    if (!cleanName) {
      return res.status(400).json({
        success: false,
        erro: "Nome obrigatório"
      });
    }

    if (!/^\d{11}$/.test(cleanCpf)) {
      return res.status(400).json({
        success: false,
        erro: "CPF inválido"
      });
    }

    const correlationID = String(
      correlation_id || lead_id || `pixauto_${Date.now()}`
    ).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);

    const comment = String(contract || "Doacao mensal").slice(0, 29);

    /*
     * A documentação atual da Woovi exige address para PIX_RECURRING.
     * Não vamos inventar endereço do pagador. Enviamos somente os dados reais
     * coletados (nome + CPF); se a conta/API exigir address, a Woovi retornará
     * a validação e isso poderá ser ajustado de forma transparente.
     */
    const subscriptionPayload = {
      name: "Pix Automatico",
      value,
      customer: {
        name: cleanName,
        taxID: cleanCpf
      },
      correlationID,
      comment,
      frequency: "MONTHLY",
      type: "PIX_RECURRING",
      pixRecurringOptions: {
        journey: "PAYMENT_ON_APPROVAL",
        retryPolicy: "THREE_RETRIES_7_DAYS"
      },
      dayGenerateCharge: new Date().toISOString(),
      dayDue: 3
    };

    console.log("WOOVI PIX AUTOMATIC PAYLOAD:", {
      ...subscriptionPayload,
      customer: { name: cleanName, taxID: "[CPF]" }
    });

    const response = await axios.post(
      "https://api.woovi.com/api/v1/subscriptions",
      subscriptionPayload,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: API_ID
        }
      }
    );

    const subscription =
      response.data?.subscription || response.data;

    const recurring =
      subscription?.pixRecurring || {};

    const emv =
      recurring?.emv ||
      response.data?.emv ||
      "";

    const subscriptionId =
      subscription?.globalID ||
      subscription?.correlationID ||
      correlationID;

    /*
     * Tracking é best-effort:
     * erro no Supabase não impede o QR de aparecer.
     */
    try {
      await supabase
        .from("pix_pagamentos")
        .insert({
          paymentid: subscriptionId,
          gclid: "",
          acc: "",
          camp: campaign || "",
          mail: "",
          valor: value,
          status: "pendente"
        });

    } catch (e) {

      console.log(
        "ERRO SUPABASE PIX AUTO:",
        e.message
      );

    }

    return res.json({
      success: true,
      paymentId: subscriptionId,
      subscriptionId,
      correlationID:
        subscription?.correlationID ||
        correlationID,
      qrCode: emv,
      brCode: emv,
      emv,
      qrCodeImage: "",
      amount: value,
      pixRecurring: recurring
    });

  } catch (error) {

    console.log(
      "ERRO WOOVI PIX AUTOMATICO:",
      error.response?.data ||
      error.message
    );

    return res.status(
      error.response?.status || 500
    ).json({
      success: false,
      erro: "Erro ao criar Pix Automático",
      detalhe:
        error.response?.data ||
        undefined
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
      isPaid:
        charge.status === "COMPLETED"
    });

  } catch (e) {

    console.log(
      e.response?.data ||
      e.message
    );

    res.json({
      success: false
    });
  }
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    "Servidor rodando na porta " + PORT
  );
});