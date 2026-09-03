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
      gclid,
      leadId,
      produto,
      produtoId,
      acc,
      camp,
      mail,
      cid,
      utm_source,
      utm_campaign,
      utm_medium,
      utm_content,
      utm_term
    } = req.body;

    console.log(req.body);

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