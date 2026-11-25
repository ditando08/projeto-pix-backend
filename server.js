require("dotenv").config();

const { GoogleAdsApi } = require("google-ads-api");
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const client = new GoogleAdsApi({
  client_id: process.env.GOOGLE_ADS_CLIENT_ID,
  client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN
});

console.log("ENV KEYS:", Object.keys(process.env));

console.log(
  "SUPABASE_URL =",
  process.env.SUPABASE_URL ? "OK" : "MISSING"
);

console.log(
  "SUPABASE_KEY =",
  process.env.SUPABASE_KEY ? "OK" : "MISSING"
);

console.log(
  "WOOVI_API_ID =",
  process.env.WOOVI_API_ID ? "OK" : "MISSING"
);

console.log(
  "NITRO_KEYS =",
  process.env.NITRO_PUBLIC_KEY && process.env.NITRO_SECRET_KEY
    ? "OK"
    : "MISSING"
);

console.log(
  "EFI_KEYS =",
  process.env.EFI_CLIENT_ID &&
    process.env.EFI_CLIENT_SECRET &&
    process.env.EFI_CERT_BASE64 &&
    process.env.EFI_PIX_KEY
    ? "OK"
    : "MISSING"
);

console.log(
  "UTMIFY_API_TOKEN =",
  process.env.UTMIFY_API_TOKEN ? "OK" : "MISSING"
);

const { createClient } = require("@supabase/supabase-js");

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


/* =========================================================
 * PIX ÚNICO
 * ========================================================= */

app.post("/criar-pix", async (req, res) => {

  console.log(req.body);
  console.log("TRACKING:", req.body);

  console.log("ROTA /criar-pix CHAMADA");

  try {

    const {
  amount,
  amount_cents,

  // Compatibilidade com projetos antigos e novo HTML
  leadId: leadIdOld,
  lead_id: leadIdNew,

  gclid,
  produto,
  produtoId,

  acc,

  camp: campOld,
  campaign: campaignNew,

  mail,
  cid,

  utm_source,
  utm_campaign,
  utm_medium,
  utm_content,
  utm_term
} = req.body;

// Mantém compatibilidade entre projetos antigos e o novo projeto
const leadId = leadIdOld || leadIdNew || "";
const camp = campOld || campaignNew || "";

    /*
     * Compatibilidade retroativa:
     * - Projetos antigos continuam enviando `amount`.
     * - O novo projeto pode enviar `amount_cents`.
     * Ambos representam centavos.
     *
     * A prioridade é `amount_cents` quando presente.
     */
    const rawAmount =
      amount_cents !== undefined &&
      amount_cents !== null &&
      amount_cents !== ""
        ? amount_cents
        : amount;

    const valueInCents = Number(rawAmount);

    console.log(req.body);
    console.log("VALOR RECEBIDO:", rawAmount);
    console.log("VALOR EM CENTAVOS:", valueInCents);

    console.log("LEAD ID RECEBIDO:", leadId);

    if (gclid || acc || camp || mail) {
      console.log("TRACKING OK");
    }

    console.log("TRACKING:", {
      gclid,
      acc,
      camp,
      mail
    });

    if (!Number.isInteger(valueInCents) || valueInCents <= 0) {
      return res.status(400).json({
        erro: "Valor do PIX inválido"
      });
    }

    const response = await axios.post(
      "https://api.woovi.com/api/v1/charge",
      {
        correlationID: "cantb_" + Date.now(),

        value: valueInCents,

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

    console.log(
      "WOOVI RESPONSE:",
      response.data
    );


    const charge =
      response.data?.charge ||
      response.data?.charges?.[0] ||
      response.data;


    try {

      if (supabase) {

        const { data, error } = await supabase
          .from("pix_pagamentos")
          .insert({
            paymentid: charge.correlationID,

            gclid: gclid || "",

            leadid: leadId || "",

            acc: acc || "",

            camp: camp || "",

            mail: mail || "",

            cid: cid || "",

            valor: charge.value,

            status: "pendente",

            utm_source: utm_source || "",

            utm_campaign: utm_campaign || "",

            utm_medium: utm_medium || "",

            utm_content: utm_content || "",

            utm_term: utm_term || "",

            produto: produto || "",

            produtoid: produtoId || ""
          });


        console.log(
          "SUPABASE DATA:",
          data
        );

        console.log(
          "SUPABASE ERROR:",
          error
        );

      }

    } catch (e) {

      console.log(
        "ERRO SUPABASE COMPLETO:",
        e
      );

    }


    console.log(
      "CHARGE FINAL:",
      charge
    );


    res.json({
  success: true,

  paymentId:
    charge.correlationID ||
    charge._id ||
    "",

  charge_id:
    charge.correlationID ||
    charge._id ||
    "",

  txid:
    charge.correlationID ||
    charge._id ||
    "",

  correlationID:
    charge.correlationID ||
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


/* =========================================================
 * PROJETO 5 — PIX WOOVI
 * =========================================================
 *
 * Rotas exclusivas do Projeto 5.
 * Não substituem nem alteram:
 *   - /criar-pix
 *   - /consultar-pix
 *   - /criar-pix-automatico
 *   - /webhook-woovi
 *
 * O frontend do Projeto 5 usa:
 *   POST /api/pix-mateus
 *   GET  /api/monitorar-mateus/:transactionId
 *
 * ========================================================= */

app.post("/api/pix-mateus", async (req, res) => {
  console.log("ROTA /api/pix-mateus CHAMADA");

  try {
    const body = req.body || {};
    const valorCents = Number(body.valor_campanha_cents);
    const utmParams = body.utm_params || {};

    const gclid = String(utmParams.gclid || "");
    const fbclid = String(utmParams.fbclid || "");
    const utm_source = String(utmParams.utm_source || "");
    const utm_campaign = String(utmParams.utm_campaign || "");
    const utm_medium = String(utmParams.utm_medium || "");
    const utm_content = String(utmParams.utm_content || "");
    const utm_term = String(utmParams.utm_term || "");
    const leadId = String(utmParams.leadId || utmParams.lead_id || "");
    const landing_url = String(utmParams.landing_url || "");

    if (!Number.isInteger(valorCents) || valorCents <= 0) {
      return res.status(400).json({
        success: false,
        error: "Valor do PIX inválido"
      });
    }

    const correlationID =
      "projeto5_" +
      Date.now() +
      "_" +
      Math.random().toString(36).slice(2, 8);

    const response = await axios.post(
      "https://api.woovi.com/api/v1/charge",
      {
        correlationID,
        value: valorCents,
        comment: "Doacao Projeto 5",
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

    const charge =
      response.data?.charge ||
      response.data?.charges?.[0] ||
      response.data;

    const paymentId =
      charge?.correlationID ||
      correlationID;

    const qrcodeText =
      charge?.brCode ||
      charge?.qrCode ||
      "";

    if (!paymentId || !qrcodeText) {
      console.log("WOOVI PROJETO 5 RESPOSTA INCOMPLETA:", response.data);

      return res.status(502).json({
        success: false,
        error: "A Woovi não retornou o código Pix esperado"
      });
    }

    /* Tracking é salvo junto com a cobrança do Projeto 5.
       Essas colunas já são utilizadas pelo webhook compartilhado. */
    try {
      if (supabase) {
        const { error } = await supabase
          .from("pix_pagamentos")
          .insert({
            paymentid: paymentId,
            gclid: gclid || "",
            leadid: leadId || "",
            acc: "",
            camp: utm_campaign || "",
            mail: "",
            cid: "",
            valor: Number(charge?.value ?? valorCents),
            status: "pendente",
            utm_source: utm_source || "",
            utm_campaign: utm_campaign || "",
            utm_medium: utm_medium || "",
            utm_content: utm_content || "",
            utm_term: utm_term || "",
            produto: "Projeto 5",
            produtoid: "projeto-5"
          });

        if (error) {
          console.log("SUPABASE PROJETO 5 ERROR:", error);
        }
      }
    } catch (e) {
      console.log("ERRO SUPABASE PROJETO 5:", e.message);
    }

    console.log("PIX PROJETO 5 CRIADO:", {
      paymentId,
      valor: charge?.value ?? valorCents,
      hasGclid: !!gclid,
      hasFbclid: !!fbclid
    });

    return res.json({
      success: true,
      transaction_id: paymentId,
      paymentId,
      qrcode_text: qrcodeText,
      brCode: qrcodeText,
      qrCode: qrcodeText,
      qrcode: charge?.qrcode || "",
      qrCodeImage: charge?.qrCodeImage || "",
      amount: Number(charge?.value ?? valorCents)
    });
  } catch (error) {
    console.log(
      "ERRO WOOVI PROJETO 5:",
      error.response?.data || error.message
    );

    return res.status(error.response?.status || 500).json({
      success: false,
      error: "Erro ao gerar PIX"
    });
  }
});


app.get("/api/monitorar-mateus/:transactionId", async (req, res) => {
  const transactionId = String(req.params.transactionId || "");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  let finalizado = false;

  const enviar = (payload) => {
    if (finalizado || res.writableEnded) return;
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const consultar = async () => {
    try {
      if (!supabase) {
        enviar({
          status: "error",
          error: "Supabase não configurado"
        });
        return;
      }

      const { data, error } = await supabase
        .from("pix_pagamentos")
        .select("status")
        .eq("paymentid", transactionId)
        .single();

      if (error) {
        return;
      }

      if (data?.status === "pago") {
        finalizado = true;
        enviar({
          status: "paid",
          transaction_id: transactionId
        });

        clearInterval(intervalo);
        clearTimeout(timeout);
        setTimeout(() => res.end(), 50);
      } else {
        enviar({
          status: "pending",
          transaction_id: transactionId
        });
      }
    } catch (e) {
      console.log("ERRO MONITOR PROJETO 5:", e.message);
    }
  };

  enviar({
    status: "pending",
    transaction_id: transactionId
  });

  const intervalo = setInterval(consultar, 2000);
  const timeout = setTimeout(() => {
    if (finalizado || res.writableEnded) return;

    finalizado = true;
    enviar({
      status: "timeout",
      transaction_id: transactionId
    });

    clearInterval(intervalo);
    res.end();
  }, 30 * 60 * 1000);

  req.on("close", () => {
    finalizado = true;
    clearInterval(intervalo);
    clearTimeout(timeout);
  });

  consultar();
});


/* =========================================================
 * NITRO PAGAMENTOS — PIX (projeto Lari)
 * =========================================================
 *
 * Doc: https://doc.nitropagamentoshub.com
 *
 * Rotas:
 *   POST /api/pix-nitro            cria a cobrança PIX na Nitro
 *   GET  /consultar-pix-nitro?id=  status (Supabase + consulta na Nitro)
 *   POST /webhook-nitro            postbackUrl chamado pela Nitro
 *
 * Variáveis de ambiente:
 *   NITRO_PUBLIC_KEY   chave pública  (pk_...)
 *   NITRO_SECRET_KEY   chave privada  (sk_...)
 *   PUBLIC_BACKEND_URL (opcional) URL pública deste backend, usada
 *                      para montar o postbackUrl. Ex.:
 *                      https://projeto-pix-backend-production.up.railway.app
 *
 * As rotas da Woovi continuam intactas para os outros projetos.
 * ========================================================= */

const NITRO_API_URL = "https://api.nitropagamento.app";

function nitroHeaders() {
  const credenciais = Buffer.from(
    `${process.env.NITRO_PUBLIC_KEY || ""}:${process.env.NITRO_SECRET_KEY || ""}`
  ).toString("base64");

  return {
    Authorization: `Basic ${credenciais}`,
    "Content-Type": "application/json"
  };
}

function nitroConfigurada() {
  return !!(process.env.NITRO_PUBLIC_KEY && process.env.NITRO_SECRET_KEY);
}

function urlPublicaBackend(req) {
  const base =
    process.env.PUBLIC_BACKEND_URL ||
    `https://${req.get("host")}`;

  return base.replace(/\/+$/, "");
}

/* Só origem + caminho (sem ?gclid=... nem #), para não mandar
   uma URL gigante de anúncio no source_url da Nitro. */
function urlHttpValida(valor) {
  try {
    const u = new URL(String(valor || ""));
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return (u.origin + u.pathname).slice(0, 255);
  } catch (e) {
    return "";
  }
}

/* Resumo do pedido para o log, sem expor dados pessoais. */
function resumoPedidoNitro(payload) {
  const c = payload.customer || {};
  const cpf = String(c.document || "");
  const email = String(c.email || "");
  const tel = String(c.phone || "");
  const arroba = email.indexOf("@");

  return {
    amount: payload.amount,
    customer: {
      name_len: String(c.name || "").length,
      name_partes: String(c.name || "").split(" ").filter(Boolean).length,
      document: cpf ? cpf.slice(0, 3) + "******" + cpf.slice(-2) : "",
      email: arroba > 0 ? email[0] + "***" + email.slice(arroba) : "",
      phone: tel ? tel.slice(0, 2) + "*****" + tel.slice(-2) : ""
    },
    postbackUrl: payload.postbackUrl,
    source_url: payload.source_url,
    tracking: payload.tracking
  };
}

/* Converte datas da Nitro ("2025-01-07T08:51:18-03:00" ou
   "2025-10-08 19:51:18", horário de Brasília) para o formato UTC
   "YYYY-MM-DD HH:MM:SS" usado pela UTMify. */
function dataNitro(valor) {
  let d = null;

  if (valor) {
    let s = String(valor).trim();

    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
      s = s.replace(" ", "T") + "-03:00";
    }

    d = new Date(s);
  }

  if (!d || isNaN(d.getTime())) d = new Date();

  return d;
}

function dataUtcUtmify(valor) {
  return dataNitro(valor).toISOString().replace("T", " ").substring(0, 19);
}

async function enviarUtmifyNitro(pagamento, orderId, paidAt, platform = "NitroPagamentos") {
  try {
    const utmify = await axios.post(
      "https://api.utmify.com.br/api-credentials/orders",
      {
        orderId,
        platform,
        paymentMethod: "pix",
        status: "paid",
        createdAt: dataUtcUtmify(pagamento.created_at),
        approvedDate: dataUtcUtmify(paidAt),
        refundedAt: null,
        customer: {
          name: "Doador",
          email: "doacao@site.com",
          phone: "11999999999",
          document: "11144477735"
        },
        products: [
          {
            id: pagamento.produtoid || "produto",
            name: pagamento.produto || "Doação",
            planId: null,
            planName: null,
            quantity: 1,
            priceInCents: pagamento.valor
          }
        ],
        trackingParameters: {
          src: null,
          sck: null,
          leadId: pagamento.leadid || null,
          utm_source: pagamento.utm_source || null,
          utm_campaign: pagamento.utm_campaign || null,
          utm_medium: pagamento.utm_medium || null,
          utm_content: pagamento.utm_content || null,
          utm_term: pagamento.utm_term || null,
          gclid: pagamento.gclid || null
        },
        commission: {
          totalPriceInCents: pagamento.valor,
          gatewayFeeInCents: 0,
          userCommissionInCents: pagamento.valor
        }
      },
      {
        headers: {
          "x-api-token": process.env.UTMIFY_API_TOKEN
        }
      }
    );

    console.log("UTMIFY NITRO:", utmify.data);
  } catch (e) {
    console.log("ERRO UTMIFY NITRO:", e.response?.data || e.message);
  }
}

/* Marca como pago no Supabase só uma vez (idempotente) e, apenas
   nessa primeira vez, envia a venda para a UTMify. Assim webhook e
   consulta de status podem confirmar sem duplicar a conversão. */
async function confirmarPagamentoNitro(transactionId, paidAt, platform = "NitroPagamentos") {
  if (!supabase || !transactionId) return false;

  const { data: atualizados, error } = await supabase
    .from("pix_pagamentos")
    .update({
      status: "pago",
      paid_at: dataNitro(paidAt).toISOString()
    })
    .eq("paymentid", transactionId)
    .neq("status", "pago")
    .select("*");

  if (error) {
    console.log("ERRO UPDATE NITRO:", error);
    return false;
  }

  const pagamento = atualizados?.[0];

  if (pagamento) {
    console.log("PIX PAGO:", platform, transactionId);
    await enviarUtmifyNitro(pagamento, transactionId, paidAt, platform);
  }

  return true;
}

function cpfValido(valor) {
  const cpf = String(valor || "").replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  for (let t = 9; t < 11; t++) {
    let soma = 0;
    for (let p = 0; p < t; p++) soma += Number(cpf[p]) * (t + 1 - p);
    if ((soma * 10) % 11 % 10 !== Number(cpf[t])) return false;
  }

  return true;
}

async function consultarTransacaoNitro(transactionId) {
  const response = await axios.get(
    `${NITRO_API_URL}/transactions/${encodeURIComponent(transactionId)}`,
    { headers: nitroHeaders(), timeout: 30000 }
  );

  return response.data?.data || null;
}


app.post("/api/pix-nitro", async (req, res) => {
  console.log("ROTA /api/pix-nitro CHAMADA");

  let pedidoParaLog = null;

  try {
    if (!nitroConfigurada()) {
      console.log("NITRO_PUBLIC_KEY / NITRO_SECRET_KEY ausentes");
      return res.status(500).json({
        success: false,
        error: "Gateway de pagamento não configurado"
      });
    }

    const body = req.body || {};
    const valorCents = Number(body.valor_campanha_cents);
    const utmParams = body.utm_params || {};

    const gclid = String(utmParams.gclid || "");
    const utm_source = String(utmParams.utm_source || "");
    const utm_campaign = String(utmParams.utm_campaign || "");
    const utm_medium = String(utmParams.utm_medium || "");
    const utm_content = String(utmParams.utm_content || "");
    const utm_term = String(utmParams.utm_term || "");
    const leadId = String(utmParams.leadId || utmParams.lead_id || "");

    if (!Number.isInteger(valorCents) || valorCents <= 0) {
      return res.status(400).json({
        success: false,
        error: "Valor do PIX inválido"
      });
    }

    /* A Nitro exige o documento real do comprador. */
    const cliente = body.cliente || {};
    const clienteNome = String(cliente.nome || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 80);
    const clienteCpf = String(cliente.cpf || "").replace(/\D/g, "");
    const clienteEmail = String(cliente.email || "").trim().slice(0, 120);

    let clienteTelefone = String(cliente.telefone || "").replace(/\D/g, "");
    if (clienteTelefone.length > 11 && clienteTelefone.startsWith("55")) {
      clienteTelefone = clienteTelefone.slice(2);
    }

    if (clienteNome.length < 3) {
      return res.status(400).json({
        success: false,
        error: "Informe seu nome completo."
      });
    }

    if (!cpfValido(clienteCpf)) {
      return res.status(400).json({
        success: false,
        error: "CPF inválido. Confira os números digitados."
      });
    }

    /* Celular é obrigatório na Nitro: DDD + 8 ou 9 dígitos. */
    if (
      !/^[1-9][1-9]\d{8,9}$/.test(clienteTelefone) ||
      (clienteTelefone.length === 11 && clienteTelefone[2] !== "9") ||
      /^(\d)\1+$/.test(clienteTelefone.slice(2))
    ) {
      return res.status(400).json({
        success: false,
        error: "Celular inválido. Informe DDD + número."
      });
    }

    /* E-mail também é obrigatório na Nitro. */
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clienteEmail)) {
      return res.status(400).json({
        success: false,
        error: clienteEmail
          ? "E-mail inválido. Confira o endereço digitado."
          : "Informe seu e-mail."
      });
    }

    const customer = {
      name: clienteNome,
      email: clienteEmail,
      document: clienteCpf,
      phone: clienteTelefone
    };

    const pedidoId =
      "lari_" +
      Date.now() +
      "_" +
      Math.random().toString(36).slice(2, 8);

    const sourceUrl =
      urlHttpValida(utmParams.landing_url) ||
      urlHttpValida(req.get("referer")) ||
      urlHttpValida(req.get("origin")) ||
      "https://avancecomlari.com/";

    const payload = {
      amount: valorCents / 100,
      payment_method: "pix",
      description: "Doacao Lari",
      items: [
        {
          title: "Doacao Lari",
          unitPrice: valorCents,
          quantity: 1,
          tangible: false
        }
      ],
      customer,
      metadata: {
        order_id: pedidoId,
        product_id: "lari"
      },
      postbackUrl: `${urlPublicaBackend(req)}/webhook-nitro`,
      tracking: {
        src: utm_source.slice(0, 100) || undefined,
        utm_source: utm_source.slice(0, 100) || undefined,
        utm_medium: utm_medium.slice(0, 100) || undefined,
        utm_campaign: utm_campaign.slice(0, 100) || undefined,
        utm_term: utm_term.slice(0, 100) || undefined,
        utm_content: utm_content.slice(0, 100) || undefined
      },
      source_url: sourceUrl,
      source_label: "Campanha Lari"
    };

    pedidoParaLog = resumoPedidoNitro(payload);

    const response = await axios.post(NITRO_API_URL, payload, {
      headers: nitroHeaders(),
      timeout: 30000
    });

    const transacao = response.data?.data || {};
    const paymentId = String(transacao.id || "");
    const qrcodeText = String(transacao.pix_code || "");

    if (!response.data?.success || !paymentId || !qrcodeText) {
      console.log("NITRO RESPOSTA INCOMPLETA:", response.data);

      return res.status(502).json({
        success: false,
        error: "A Nitro não retornou o código Pix esperado"
      });
    }

    let qrCodeImage = String(transacao.pix_qr_code || "");
    if (qrCodeImage && !qrCodeImage.startsWith("data:")) {
      qrCodeImage = "data:image/png;base64," + qrCodeImage;
    }

    try {
      if (supabase) {
        const { error } = await supabase
          .from("pix_pagamentos")
          .insert({
            paymentid: paymentId,
            gclid: gclid || "",
            leadid: leadId || "",
            acc: "",
            camp: utm_campaign || "",
            mail: "",
            cid: "",
            valor: valorCents,
            status: "pendente",
            utm_source: utm_source || "",
            utm_campaign: utm_campaign || "",
            utm_medium: utm_medium || "",
            utm_content: utm_content || "",
            utm_term: utm_term || "",
            produto: "Lari",
            produtoid: "lari"
          });

        if (error) {
          console.log("SUPABASE NITRO ERROR:", error);
        }
      }
    } catch (e) {
      console.log("ERRO SUPABASE NITRO:", e.message);
    }

    console.log("PIX NITRO CRIADO:", {
      paymentId,
      pedidoId,
      valorCents,
      hasGclid: !!gclid
    });

    return res.json({
      success: true,
      transaction_id: paymentId,
      paymentId,
      qrcode_text: qrcodeText,
      brCode: qrcodeText,
      qrCode: qrcodeText,
      qrCodeImage,
      amount: valorCents,
      expires_at: transacao.expires_at || null
    });
  } catch (error) {
    console.log(
      "ERRO NITRO PIX:",
      error.response?.status,
      error.response?.data || error.message
    );

    if (pedidoParaLog) {
      console.log(
        "PEDIDO ENVIADO A NITRO:",
        new Date().toISOString(),
        JSON.stringify({
          ...pedidoParaLog,
          cf_ray: error.response?.headers?.["cf-ray"] || null,
          request_id: error.response?.headers?.["x-request-id"] || null
        })
      );
    }

    /* Recusa de validação da Nitro (ex.: documento inválido):
       repassa a mensagem para o doador poder corrigir. */
    const status = error.response?.status;
    const mensagemNitro = error.response?.data?.error;

    if (status === 400 || status === 422) {
      return res.status(400).json({
        success: false,
        error:
          typeof mensagemNitro === "string" && mensagemNitro
            ? mensagemNitro
            : "Não foi possível gerar o Pix. Confira seus dados."
      });
    }

    return res.status(502).json({
      success: false,
      error: "Erro ao gerar PIX. Tente novamente."
    });
  }
});


app.get("/consultar-pix-nitro", async (req, res) => {
  const id = String(req.query.id || "");

  if (!id) {
    return res.status(400).json({ success: false, isPaid: false });
  }

  try {
    if (!supabase) {
      return res.status(500).json({
        success: false,
        isPaid: false,
        error: "Supabase não configurado"
      });
    }

    const { data } = await supabase
      .from("pix_pagamentos")
      .select("status")
      .eq("paymentid", id)
      .single();

    if (!data) {
      return res.json({ success: true, isPaid: false });
    }

    if (data.status === "pago") {
      return res.json({ success: true, isPaid: true });
    }

    /* Se o webhook ainda não chegou, confirma direto na Nitro. */
    if (nitroConfigurada()) {
      try {
        const transacao = await consultarTransacaoNitro(id);

        if (transacao?.status === "pago") {
          await confirmarPagamentoNitro(id, transacao.paid_at);
          return res.json({ success: true, isPaid: true });
        }
      } catch (e) {
        console.log(
          "ERRO CONSULTA NITRO:",
          e.response?.data || e.message
        );
      }
    }

    return res.json({ success: true, isPaid: false });
  } catch (e) {
    console.log("ERRO CONSULTA PIX NITRO:", e.message);
    return res.json({ success: false, isPaid: false });
  }
});


app.post("/webhook-nitro", async (req, res) => {
  const evento = req.body?.event;
  const transactionId = String(req.body?.data?.transaction_id || "");

  console.log("WEBHOOK NITRO RECEBIDO:", evento, transactionId);

  try {
    if (evento !== "transaction.paid" || !transactionId) {
      return res.status(200).json({ status: "ignored" });
    }

    /* A Nitro não assina o webhook: antes de marcar como pago,
       confirma o status direto na API com as nossas credenciais. */
    const transacao = await consultarTransacaoNitro(transactionId);

    if (transacao?.status !== "pago") {
      console.log(
        "WEBHOOK NITRO NÃO CONFIRMADO NA API:",
        transactionId,
        transacao?.status
      );
      return res.status(200).json({ status: "not_paid" });
    }

    await confirmarPagamentoNitro(
      transactionId,
      req.body?.data?.paid_at || transacao.paid_at
    );

    return res.status(200).json({ status: "received" });
  } catch (e) {
    console.log("ERRO WEBHOOK NITRO:", e.response?.data || e.message);
    return res.sendStatus(500);
  }
});


/* =========================================================
 * EFÍ BANK — PIX (projeto Lari)
 * =========================================================
 *
 * Doc: https://dev.efipay.com.br/docs/api-pix
 *
 * Rotas (mesmo formato de pedido/resposta das rotas Nitro):
 *   POST /api/pix-efi            cria a cobrança imediata (cob)
 *   GET  /consultar-pix-efi?id=  status (Supabase + consulta na Efí)
 *
 * Sem webhook: a Efí exige mTLS no servidor do webhook, o que a
 * Railway não oferece. Em vez disso, o backend confere a cada
 * minuto os Pix Efí pendentes das últimas 3 horas, e o site
 * consulta o status a cada 3s enquanto está aberto.
 *
 * Variáveis de ambiente:
 *   EFI_CLIENT_ID       Client_Id da aplicação (Produção)
 *   EFI_CLIENT_SECRET   Client_Secret da aplicação (Produção)
 *   EFI_CERT_BASE64     certificado .p12 da Efí convertido em base64
 *   EFI_PIX_KEY         chave Pix cadastrada na conta Efí
 *   EFI_CERT_PASSWORD   (opcional) senha do .p12, normalmente vazia
 *   EFI_SANDBOX         (opcional) "true" para homologação
 * ========================================================= */

const https = require("https");

const EFI_API_URL =
  process.env.EFI_SANDBOX === "true"
    ? "https://pix-h.api.efipay.com.br"
    : "https://pix.api.efipay.com.br";

let efiAgent = null;
let efiToken = null;
let efiTokenExpiraEm = 0;

function efiConfigurada() {
  return !!(
    process.env.EFI_CLIENT_ID &&
    process.env.EFI_CLIENT_SECRET &&
    process.env.EFI_CERT_BASE64 &&
    process.env.EFI_PIX_KEY
  );
}

function efiHttpsAgent() {
  if (!efiAgent) {
    efiAgent = new https.Agent({
      pfx: Buffer.from(
        String(process.env.EFI_CERT_BASE64 || "").replace(/\s/g, ""),
        "base64"
      ),
      passphrase: process.env.EFI_CERT_PASSWORD || "",
      keepAlive: true
    });
  }
  return efiAgent;
}

async function efiAccessToken() {
  if (efiToken && Date.now() < efiTokenExpiraEm) return efiToken;

  const credenciais = Buffer.from(
    `${process.env.EFI_CLIENT_ID}:${process.env.EFI_CLIENT_SECRET}`
  ).toString("base64");

  const response = await axios.post(
    `${EFI_API_URL}/oauth/token`,
    { grant_type: "client_credentials" },
    {
      httpsAgent: efiHttpsAgent(),
      headers: {
        Authorization: `Basic ${credenciais}`,
        "Content-Type": "application/json"
      },
      timeout: 30000
    }
  );

  efiToken = response.data.access_token;
  const validade = Number(response.data.expires_in) || 3600;
  efiTokenExpiraEm = Date.now() + (validade - 60) * 1000;

  return efiToken;
}

async function efiRequest(method, path, data) {
  const token = await efiAccessToken();

  try {
    const response = await axios({
      method,
      url: `${EFI_API_URL}${path}`,
      data,
      httpsAgent: efiHttpsAgent(),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      timeout: 30000
    });
    return response.data;
  } catch (e) {
    /* Token revogado/expirado antes do previsto: renova e tenta 1x. */
    if (e.response?.status === 401) {
      efiToken = null;
      const novoToken = await efiAccessToken();
      const response = await axios({
        method,
        url: `${EFI_API_URL}${path}`,
        data,
        httpsAgent: efiHttpsAgent(),
        headers: {
          Authorization: `Bearer ${novoToken}`,
          "Content-Type": "application/json"
        },
        timeout: 30000
      });
      return response.data;
    }
    throw e;
  }
}

/* Consulta a cobrança na Efí e, se estiver paga (CONCLUIDA),
   confirma no Supabase e envia para a UTMify (uma única vez). */
async function verificarPagamentoEfi(txid) {
  const cob = await efiRequest("get", `/v2/cob/${encodeURIComponent(txid)}`);

  if (cob?.status !== "CONCLUIDA") return false;

  const paidAt = cob.pix?.[0]?.horario || new Date().toISOString();
  await confirmarPagamentoNitro(txid, paidAt, "EfiBank");

  return true;
}


app.post("/api/pix-efi", async (req, res) => {
  console.log("ROTA /api/pix-efi CHAMADA");

  try {
    if (!efiConfigurada()) {
      console.log("Variáveis EFI_* ausentes");
      return res.status(500).json({
        success: false,
        error: "Gateway de pagamento não configurado"
      });
    }

    const body = req.body || {};
    const valorCents = Number(body.valor_campanha_cents);
    const utmParams = body.utm_params || {};

    const gclid = String(utmParams.gclid || "");
    const utm_source = String(utmParams.utm_source || "");
    const utm_campaign = String(utmParams.utm_campaign || "");
    const utm_medium = String(utmParams.utm_medium || "");
    const utm_content = String(utmParams.utm_content || "");
    const utm_term = String(utmParams.utm_term || "");
    const leadId = String(utmParams.leadId || utmParams.lead_id || "");

    if (!Number.isInteger(valorCents) || valorCents <= 0) {
      return res.status(400).json({
        success: false,
        error: "Valor do PIX inválido"
      });
    }

    const cobranca = {
      calendario: { expiracao: 3600 },
      valor: { original: (valorCents / 100).toFixed(2) },
      chave: process.env.EFI_PIX_KEY,
      solicitacaoPagador: "Doacao Lari"
    };

    /* Na Efí os dados do pagador são opcionais. Se o site enviar
       nome + CPF válidos, eles vão como "devedor" da cobrança. */
    const cliente = body.cliente || {};
    const clienteNome = String(cliente.nome || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 80);
    const clienteCpf = String(cliente.cpf || "").replace(/\D/g, "");

    if (clienteNome.length >= 3 && cpfValido(clienteCpf)) {
      cobranca.devedor = { cpf: clienteCpf, nome: clienteNome };
    }

    const cob = await efiRequest("post", "/v2/cob", cobranca);

    const txid = String(cob?.txid || "");
    const qrcodeText = String(cob?.pixCopiaECola || "");

    if (!txid || !qrcodeText) {
      console.log("EFI RESPOSTA INCOMPLETA:", cob);
      return res.status(502).json({
        success: false,
        error: "A Efí não retornou o código Pix esperado"
      });
    }

    /* Imagem do QR Code (opcional: o copia e cola já basta). */
    let qrCodeImage = "";
    try {
      if (cob.loc?.id) {
        const qr = await efiRequest("get", `/v2/loc/${cob.loc.id}/qrcode`);
        qrCodeImage = String(qr?.imagemQrcode || "");
      }
    } catch (e) {
      console.log("ERRO QRCODE EFI:", e.response?.data || e.message);
    }

    try {
      if (supabase) {
        const { error } = await supabase
          .from("pix_pagamentos")
          .insert({
            paymentid: txid,
            gclid: gclid || "",
            leadid: leadId || "",
            acc: "",
            camp: utm_campaign || "",
            mail: "",
            cid: "",
            valor: valorCents,
            status: "pendente",
            utm_source: utm_source || "",
            utm_campaign: utm_campaign || "",
            utm_medium: utm_medium || "",
            utm_content: utm_content || "",
            utm_term: utm_term || "",
            produto: "Lari",
            produtoid: "lari-efi"
          });

        if (error) {
          console.log("SUPABASE EFI ERROR:", error);
        }
      }
    } catch (e) {
      console.log("ERRO SUPABASE EFI:", e.message);
    }

    console.log("PIX EFI CRIADO:", {
      txid,
      valorCents,
      comDevedor: !!cobranca.devedor,
      hasGclid: !!gclid
    });

    return res.json({
      success: true,
      transaction_id: txid,
      paymentId: txid,
      qrcode_text: qrcodeText,
      brCode: qrcodeText,
      qrCode: qrcodeText,
      qrCodeImage,
      amount: valorCents
    });
  } catch (error) {
    console.log(
      "ERRO EFI PIX:",
      new Date().toISOString(),
      error.response?.status,
      error.response?.data || error.message
    );

    const status = error.response?.status;
    const mensagemEfi = error.response?.data?.mensagem;

    if (status === 400) {
      return res.status(400).json({
        success: false,
        error:
          typeof mensagemEfi === "string" && mensagemEfi
            ? mensagemEfi
            : "Não foi possível gerar o Pix. Confira seus dados."
      });
    }

    return res.status(502).json({
      success: false,
      error: "Erro ao gerar PIX. Tente novamente."
    });
  }
});


app.get("/consultar-pix-efi", async (req, res) => {
  const id = String(req.query.id || "");

  if (!id) {
    return res.status(400).json({ success: false, isPaid: false });
  }

  try {
    if (!supabase) {
      return res.status(500).json({
        success: false,
        isPaid: false,
        error: "Supabase não configurado"
      });
    }

    const { data } = await supabase
      .from("pix_pagamentos")
      .select("status")
      .eq("paymentid", id)
      .single();

    if (!data) {
      return res.json({ success: true, isPaid: false });
    }

    if (data.status === "pago") {
      return res.json({ success: true, isPaid: true });
    }

    if (efiConfigurada()) {
      try {
        if (await verificarPagamentoEfi(id)) {
          return res.json({ success: true, isPaid: true });
        }
      } catch (e) {
        console.log("ERRO CONSULTA EFI:", e.response?.data || e.message);
      }
    }

    return res.json({ success: true, isPaid: false });
  } catch (e) {
    console.log("ERRO CONSULTA PIX EFI:", e.message);
    return res.json({ success: false, isPaid: false });
  }
});


/* Conferência periódica: confirma Pix Efí pagos mesmo que o
   doador tenha fechado a página antes da confirmação. */
let conferindoEfi = false;

async function conferirPendentesEfi() {
  if (conferindoEfi || !supabase || !efiConfigurada()) return;
  conferindoEfi = true;

  try {
    const desde = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

    const { data: pendentes, error } = await supabase
      .from("pix_pagamentos")
      .select("paymentid")
      .eq("produtoid", "lari-efi")
      .eq("status", "pendente")
      .gte("created_at", desde)
      .limit(50);

    if (error) {
      console.log("ERRO LISTAR PENDENTES EFI:", error);
      return;
    }

    for (const p of pendentes || []) {
      try {
        await verificarPagamentoEfi(p.paymentid);
      } catch (e) {
        console.log(
          "ERRO CONFERIR EFI:",
          p.paymentid,
          e.response?.data || e.message
        );
      }
    }
  } finally {
    conferindoEfi = false;
  }
}

setInterval(conferirPendentesEfi, 60 * 1000);


/* =========================================================
 * PIX AUTOMÁTICO
 * =========================================================
 *
 * Adicionado ao backend antigo para manter:
 *
 * - PIX único
 * - Supabase
 * - Webhook Woovi
 * - UTMify
 * - Google Ads
 *
 * sem remover as funcionalidades anteriores.
 *
 * ========================================================= */

app.post("/criar-pix-automatico", async (req, res) => {

  console.log(
    "ROTA /criar-pix-automatico CHAMADA"
  );


  try {

    const {
      amount_cents,
      name,
      cpf,
      lead_id,
      correlation_id,
      campaign,
      contract
    } = req.body || {};


    const value = Number(amount_cents);

    const cleanCpf =
      String(cpf || "")
        .replace(/\D/g, "");

    const cleanName =
      String(name || "")
        .trim();


    if (
      !Number.isInteger(value) ||
      value <= 0
    ) {

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


    const correlationID =
      String(
        correlation_id ||
        lead_id ||
        `pixauto_${Date.now()}`
      )
        .replace(
          /[^a-zA-Z0-9_-]/g,
          ""
        )
        .slice(0, 80);


    const comment =
      String(
        contract ||
        "Doacao mensal"
      ).slice(0, 29);


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

        journey:
          "PAYMENT_ON_APPROVAL",

        retryPolicy:
          "THREE_RETRIES_7_DAYS"

      },

      dayGenerateCharge:
        new Date().toISOString(),

      dayDue: 3

    };


    console.log(
      "WOOVI PIX AUTOMATIC PAYLOAD:",
      {
        ...subscriptionPayload,

        customer: {
          name: cleanName,
          taxID: "[CPF]"
        }
      }
    );


    const response = await axios.post(

      "https://api.woovi.com/api/v1/subscriptions",

      subscriptionPayload,

      {
        headers: {

          "Content-Type":
            "application/json",

          Authorization: API_ID

        }

      }

    );


    const subscription =
      response.data?.subscription ||
      response.data;


    const recurring =
      subscription?.pixRecurring ||
      {};


    const emv =
      recurring?.emv ||
      response.data?.emv ||
      "";


    const subscriptionId =
      subscription?.globalID ||
      subscription?.correlationID ||
      correlationID;


    /*
     * Tracking é best-effort.
     * Se houver erro no Supabase,
     * não impede o QR do Pix Automático.
     */

    try {

      if (supabase) {

        await supabase

          .from("pix_pagamentos")

          .insert({

            paymentid:
              subscriptionId,

            gclid: "",

            leadid:
              lead_id || "",

            acc: "",

            camp:
              campaign || "",

            mail: "",

            cid: "",

            valor: value,

            status: "pendente",

            utm_source: "",

            utm_campaign:
              campaign || "",

            utm_medium: "",

            utm_content: "",

            utm_term: "",

            produto:
              contract ||
              "Doação mensal",

            produtoid:
              "pix-automatico"

          });

      }

    } catch (e) {

      console.log(
        "ERRO SUPABASE PIX AUTO:",
        e.message
      );

    }


    return res.json({

      success: true,

      paymentId:
        subscriptionId,

      subscriptionId,

      correlationID:
        subscription?.correlationID ||
        correlationID,

      qrCode: emv,

      brCode: emv,

      emv,

      qrCodeImage: "",

      amount: value,

      pixRecurring:
        recurring

    });


  } catch (error) {

    console.log(

      "ERRO WOOVI PIX AUTOMATICO:",

      error.response?.data ||
      error.message

    );


    return res.status(

      error.response?.status ||
      500

    ).json({

      success: false,

      erro:
        "Erro ao criar Pix Automático",

      detalhe:
        error.response?.data ||
        undefined

    });

  }

});


/* =========================================================
 * HOME
 * ========================================================= */

app.get("/", (req, res) => {

  res.send(
    "Backend online"
  );

});


/* =========================================================
 * TESTE ENV GOOGLE
 * ========================================================= */

app.get(
  "/teste-env-google",
  (req, res) => {

    res.json({

      client_id:
        process.env.GOOGLE_ADS_CLIENT_ID
          ? "OK"
          : "MISSING",

      client_secret:
        process.env.GOOGLE_ADS_CLIENT_SECRET
          ? "OK"
          : "MISSING",

      developer_token:
        process.env.GOOGLE_ADS_DEVELOPER_TOKEN
          ? "OK"
          : "MISSING",

      refresh_token:
        process.env.GOOGLE_ADS_REFRESH_TOKEN
          ? "OK"
          : "MISSING",

      login_customer_id:
        process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID
          ? "OK"
          : "MISSING"

    });

  }
);


/* =========================================================
 * LISTAR CONVERSÕES GOOGLE ADS
 * ========================================================= */

app.get(
  "/listar-conversoes",
  async (req, res) => {

    try {

      const customer =
        client.Customer({

          customer_id:
            "4252949966",

          refresh_token:
            process.env.GOOGLE_ADS_REFRESH_TOKEN,

          login_customer_id:
            process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID

        });


      const conversoes =
        await customer.query(`

          SELECT

            conversion_action.id,

            conversion_action.name,

            conversion_action.type,

            conversion_action.status

          FROM conversion_action

        `);


      res.json({

        success: true,

        conversoes

      });


    } catch (e) {

      res.json({

        success: false,

        error: e.message,

        details: e

      });

    }

  }
);


/* =========================================================
 * CONSULTAR PIX
 * ========================================================= */

app.get(
  "/consultar-pix",
  async (req, res) => {

    try {

      const id =
        req.query.id;


      if (!supabase) {

        return res.status(500).json({

          success: false,

          isPaid: false,

          error:
            "Supabase não configurado"

        });

      }


      const {
        data,
        error
      } = await supabase

        .from("pix_pagamentos")

        .select("status")

        .eq(
          "paymentid",
          id
        )

        .single();


      console.log(
        "CONSULTA STATUS:",
        id,
        data
      );


      res.json({

        success: true,

        isPaid:
          data?.status === "pago"

      });


    } catch (e) {

      console.log(
        "ERRO CONSULTA:",
        e
      );


      res.json({

        success: false,

        isPaid: false

      });

    }

  }
);


/* =========================================================
 * WEBHOOK WOOVI
 *
 * Esse é o trecho importante para a UTMify.
 *
 * Quando a Woovi confirma:
 *
 * OPENPIX:CHARGE_COMPLETED
 *
 * o pagamento é atualizado no Supabase
 * e posteriormente enviado para a UTMify.
 *
 * ========================================================= */

app.post(
  "/webhook-woovi",
  async (req, res) => {

    console.log(
      "########################"
    );

    console.log(
      "WEBHOOK WOOVI RECEBIDO"
    );

    console.log(
      "EVENTO:",
      req.body?.event
    );

    console.log(
      "CORRELATION:",
      req.body?.charge?.correlationID
    );

    console.log(
      "########################"
    );


    try {

      console.log(
        "WEBHOOK:",
        JSON.stringify(
          req.body,
          null,
          2
        )
      );


      if (
        req.body.event ===
        "OPENPIX:CHARGE_COMPLETED"
      ) {

        const correlationID =
          req.body.charge?.correlationID;


        const paidAt =
          req.body.charge?.paidAt ||
          new Date().toISOString();


        console.log(
          "PIX PAGO:",
          correlationID
        );


        console.log(
          "TOKEN UTMIFY:",
          process.env.UTMIFY_API_TOKEN
            ? "OK"
            : "MISSING"
        );


        if (!supabase) {

          console.log(
            "SUPABASE NÃO CONFIGURADO"
          );

          return res.sendStatus(500);

        }


        const {
          error
        } = await supabase

          .from("pix_pagamentos")

          .update({

            status: "pago",

            paid_at: paidAt

          })

          .eq(
            "paymentid",
            correlationID
          );


        console.log(
          "UPDATE ERROR:",
          error
        );


        const {
          data: pagamento
        } = await supabase

          .from("pix_pagamentos")

          .select("*")

          .eq(
            "paymentid",
            correlationID
          )

          .single();


        console.log(
          "PAGAMENTO:",
          pagamento
        );


        if (pagamento) {

          try {

            console.log(
              "ENVIANDO PARA UTMIFY:",
              {

                leadId:
                  pagamento.leadid,

                gclid:
                  pagamento.gclid,

                utm_source:
                  pagamento.utm_source,

                utm_campaign:
                  pagamento.utm_campaign

              }
            );


            const utmify =
              await axios.post(

                "https://api.utmify.com.br/api-credentials/orders",

                {

                  orderId:
                    correlationID,


                  platform:
                    "Woovi",


                  paymentMethod:
                    "pix",


                  status:
                    "paid",


                  createdAt:

                    pagamento.created_at
                      ?.replace(
                        "T",
                        " "
                      )
                      ?.substring(
                        0,
                        19
                      ),


                  approvedDate:

                    paidAt
                      ?.replace(
                        "T",
                        " "
                      )
                      ?.substring(
                        0,
                        19
                      ),


                  refundedAt:
                    null,


                  customer: {

                    name:
                      "Doador",

                    email:
                      "doacao@site.com",

                    phone:
                      "11999999999",

                    document:
                      "11144477735"

                  },


                  products: [

                    {

                      id:
                        pagamento.produtoid ||
                        "produto",


                      name:
                        pagamento.produto ||
                        "Doação",


                      planId:
                        null,


                      planName:
                        null,


                      quantity:
                        1,


                      priceInCents:
                        pagamento.valor

                    }

                  ],


                  trackingParameters: {

                    src:
                      null,


                    sck:
                      null,


                    leadId:
                      pagamento.leadid ||
                      null,


                    utm_source:
                      pagamento.utm_source ||
                      null,


                    utm_campaign:
                      pagamento.utm_campaign ||
                      null,


                    utm_medium:
                      pagamento.utm_medium ||
                      null,


                    utm_content:
                      pagamento.utm_content ||
                      null,


                    utm_term:
                      pagamento.utm_term ||
                      null,


                    gclid:
                      pagamento.gclid ||
                      null

                  },


                  commission: {

                    totalPriceInCents:
                      pagamento.valor,


                    gatewayFeeInCents:
                      0,


                    userCommissionInCents:
                      pagamento.valor

                  }

                },


                {

                  headers: {

                    "x-api-token":
                      process.env
                        .UTMIFY_API_TOKEN

                  }

                }

              );


            console.log(
              "UTMIFY:",
              utmify.data
            );


          } catch (e) {

            console.log(
              "ERRO UTMIFY:",
              e.response?.data ||
              e.message
            );

          }

        }

      }


      res.sendStatus(200);


    } catch (e) {

      console.log(
        "ERRO WEBHOOK:",
        e
      );


      res.sendStatus(500);

    }

  }
);


/* =========================================================
 * TESTE UTMIFY
 * ========================================================= */

app.get(
  "/teste-utmify",
  (req, res) => {

    res.json({

      token:
        process.env.UTMIFY_API_TOKEN
          ? "OK"
          : "MISSING"

    });

  }
);


/* =========================================================
 * ENV KEYS
 * ========================================================= */

app.get(
  "/env-keys",
  (req, res) => {

    res.json(
      Object.keys(
        process.env
      )
    );

  }
);


/* =========================================================
 * TESTE WEBHOOK
 * ========================================================= */

app.get(
  "/teste-webhook",
  (req, res) => {

    console.log(
      "TESTE WEBHOOK FUNCIONOU"
    );

    res.send("OK");

  }
);


/* =========================================================
 * TESTE CONTA GOOGLE
 * ========================================================= */

app.get(
  "/teste-conta",
  async (req, res) => {

    const {
      data,
      error
    } = await supabase

      .from(
        "google_ads_accounts"
      )

      .select("*")

      .eq(
        "cid",
        "4252949966"
      );


    res.json({

      data,

      error

    });

  }
);


/* =========================================================
 * TESTE PAGAMENTO
 * ========================================================= */

app.get(
  "/teste-pagamento",
  async (req, res) => {

    const {
      data
    } = await supabase

      .from(
        "pix_pagamentos"
      )

      .select("*")

      .eq(
        "id",
        94
      )

      .single();


    res.json(data);

  }
);


/* =========================================================
 * TESTE SUPABASE
 * ========================================================= */

app.get(
  "/teste-supabase",
  async (req, res) => {

    res.json({

      supabaseUrl:
        process.env.SUPABASE_URL

    });

  }
);


/* =========================================================
 * TESTE GOOGLE
 * ========================================================= */

app.get(
  "/teste-google",
  async (req, res) => {

    try {

      const {
        data,
        error
      } = await supabase

        .from(
          "pix_pagamentos"
        )

        .select("*")

        .eq(
          "status",
          "pago"
        )

        .eq(
          "conversion_sent",
          false
        )

        .limit(1);


      res.json({

        success: true,

        data,

        error

      });


    } catch (e) {

      res.json({

        success: false,

        error:
          e.message

      });

    }

  }
);


/* =========================================================
 * TESTE CONVERSÃO
 * ========================================================= */

app.get(
  "/teste-conversao",
  async (req, res) => {

    const {
      data,
      error
    } = await supabase

      .from(
        "pix_pagamentos"
      )

      .select("*")

      .eq(
        "status",
        "pago"
      )

      .eq(
        "conversion_sent",
        false
      )

      .order(
        "id",
        {
          ascending: false
        }
      )

      .limit(1);


    res.json({

      data,

      error

    });

  }
);


/* =========================================================
 * START SERVER
 * ========================================================= */

const PORT =
  process.env.PORT || 3000;


app.listen(
  PORT,
  () => {

    console.log(
      "Servidor rodando na porta " +
      PORT
    );

  }
);