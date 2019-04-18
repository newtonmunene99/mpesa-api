"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = require("axios");
const crypto = require("crypto");
const constants = require("constants");
const path = require("path");
const fs = require("fs");
const buffer_1 = require("buffer");
const routes_1 = require("./helpers/routes");
class Mpesa {
  constructor(credentials, environment) {
    this.client_key = credentials.client_key;
    this.client_secret = credentials.client_secret;
    this.baseURL =
      environment === "production"
        ? routes_1.routes.production
        : routes_1.routes.sandbox;
    this.generateSecurityCredential(
      credentials.initiator_password,
      credentials.certificatepath
    );
    console.log(this.securitycredential);
  }
  c2bRegister(data) {
    return new Promise((resolve, reject) => {
      this.authenticate()
        .then(token => {
          axios_1
            .default({
              method: "post",
              url: this.baseURL + routes_1.routes.c2bregister,
              headers: {
                Authorization: "Bearer " + token
              },
              data: {
                ShortCode: data.ShortCode,
                ResponseType: data.ResponseType,
                ConfirmationURL: data.ConfirmationURL,
                ValidationURL: data.ValidationURL
              }
            })
            .then(response => {
              resolve(response.data);
            })
            .catch(error => {
              reject(error.data);
            });
        })
        .catch(error => {
          reject(error);
        });
    });
  }
  c2bSimulate(data) {
    return new Promise((resolve, reject) => {
      this.authenticate()
        .then(token => {
          axios_1
            .default({
              method: "post",
              url: this.baseURL + routes_1.routes.c2bsimulate,
              headers: {
                Authorization: "Bearer " + token
              },
              data: {
                ShortCode: data.ShortCode,
                CommandID: data.CommandID,
                Amount: data.Amount,
                Msisdn: data.Msisdn,
                BillRefNumber: data.BillRefNumber
                  ? data.BillRefNumber
                  : "account"
              }
            })
            .then(response => {
              resolve(response.data);
            })
            .catch(error => {
              reject(error.data);
            });
        })
        .catch(error => {
          reject(error);
        });
    });
  }
  b2c(data) {
    return new Promise((resolve, reject) => {
      this.authenticate()
        .then(token => {
          axios_1
            .default({
              method: "post",
              url: this.baseURL + routes_1.routes.b2c,
              headers: {
                Authorization: "Bearer " + token
              },
              data: {
                InitiatorName: data.Initiator,
                SecurityCredential: this.securitycredential,
                CommandID: data.CommandID,
                Amount: data.Amount,
                PartyA: data.PartyA,
                PartyB: data.PartyB,
                Remarks: data.Remarks ? data.Remarks : "account",
                QueueTimeOutURL: data.QueueTimeOutURL,
                ResultURL: data.ResultURL,
                Occasion: data.Occasion ? data.Occasion : "account"
              }
            })
            .then(response => {
              resolve(response.data);
            })
            .catch(error => {
              reject(error.data);
            });
        })
        .catch(error => {
          reject(error);
        });
    });
  }
  lipaNaMpesaOnline(data) {
    return new Promise((resolve, reject) => {
      const Timestamp = new Date()
        .toISOString()
        .replace(/[^0-9]/g, "")
        .slice(0, -3);
      const Password = buffer_1.Buffer.from(
        data.BusinessShortCode + data.passKey + Timestamp
      ).toString("base64");
      this.authenticate()
        .then(token => {
          axios_1
            .default({
              method: "post",
              url: this.baseURL + routes_1.routes.stkpush,
              headers: {
                Authorization: "Bearer " + token
              },
              data: {
                BusinessShortCode: data.BusinessShortCode,
                Password: Password,
                Timestamp: Timestamp,
                TransactionType: data.TransactionType
                  ? data.TransactionType
                  : "CustomerPayBillOnline ",
                Amount: data.Amount,
                PartyA: data.PartyA,
                PartyB: data.PartyB,
                PhoneNumber: data.PhoneNumber,
                CallBackURL: data.CallBackURL,
                AccountReference: data.AccountReference,
                TransactionDesc: data.TransactionDesc
                  ? data.TransactionDesc
                  : "Lipa Na Mpesa Online"
              }
            })
            .then(response => {
              resolve(response.data);
            })
            .catch(error => {
              reject(error.data);
            });
        })
        .catch(error => {
          reject(error);
        });
    });
  }
  reversal(data) {
    return new Promise((resolve, reject) => {
      this.authenticate()
        .then(token => {
          axios_1
            .default({
              method: "post",
              url: this.baseURL + routes_1.routes.reversal,
              headers: {
                Authorization: "Bearer " + token
              },
              data: {
                Initiator: data.Initiator,
                SecurityCredential: this.securitycredential,
                CommandID: data.CommandID,
                TransactionID: data.TransactionID,
                Amount: data.Amount,
                ReceiverParty: data.ReceiverParty,
                RecieverIdentifierType: data.RecieverIdentifierType
                  ? data.RecieverIdentifierType
                  : "4",
                ResultURL: data.ResultURL,
                QueueTimeOutURL: data.QueueTimeOutURL,
                Remarks: data.Remarks ? data.Remarks : "Reversal",
                Occasion: data.Occasion ? data.Occasion : "Reversal"
              }
            })
            .then(response => {
              resolve(response.data);
            })
            .catch(error => {
              reject(error.data);
            });
        })
        .catch(error => {
          reject(error);
        });
    });
  }
  accountBalance(data) {
    return new Promise((resolve, reject) => {
      this.authenticate()
        .then(token => {
          axios_1
            .default({
              method: "post",
              url: this.baseURL + routes_1.routes.accountbalance,
              headers: { Authorization: "Bearer " + token },
              data: {
                Initiator: data.Initiator,
                SecurityCredential: this.securitycredential,
                CommandID: data.CommandID,
                PartyA: data.PartyA,
                IdentifierType: data.IdentifierType ? data.IdentifierType : "4",
                Remarks: data.Remarks ? data.Remarks : "Account Balance",
                QueueTimeOutURL: data.QueueTimeOutURL,
                ResultURL: data.ResultURL
              }
            })
            .then(response => {
              resolve(response.data);
            })
            .catch(error => {
              reject(error);
            });
        })
        .catch(error => {
          reject(error);
        });
    });
  }
  authenticate() {
    return new Promise((resolve, reject) => {
      axios_1
        .default({
          method: "get",
          url: this.baseURL + routes_1.routes.oauth,
          headers: {
            Authorization:
              "Basic " +
              buffer_1.Buffer.from(
                this.client_key + ":" + this.client_secret
              ).toString("base64")
          }
        })
        .then(response => {
          resolve(response.data.access_token);
        })
        .catch(error => {
          reject(error.data);
        });
    });
  }
  generateSecurityCredential(password, certificatepath) {
    var certificate;
    if (certificatepath != null) {
      certificate = String(fs.readFileSync(certificatepath));
    } else {
      certificate = String(
        fs.readFileSync(
          path.resolve(
            __dirname,
            this.environment === "production"
              ? "keys/production-cert.cer"
              : "keys/sandbox-cert.cer"
          )
        )
      );
    }
    this.securitycredential = crypto
      .publicEncrypt(
        { key: certificate, padding: constants.RSA_PKCS1_PADDING },
        buffer_1.Buffer.from(password)
      )
      .toString("base64");
  }
}
exports.Mpesa = Mpesa;
//# sourceMappingURL=index.js.map
