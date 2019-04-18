import { b2cinterface, c2bregisterinterface, c2bsimulateinterface, accountbalanceinterface, stkpushinterface, reversalinterface, credentialsinterface } from "./helpers/interfaces";
export declare class Mpesa {
    private baseURL;
    private environment;
    private client_key;
    private client_secret;
    private securitycredential;
    constructor(credentials: credentialsinterface, environment: "production" | "sandbox");
    c2bRegister(data: c2bregisterinterface): Promise<{}>;
    c2bSimulate(data: c2bsimulateinterface): Promise<{}>;
    b2c(data: b2cinterface): Promise<{}>;
    lipaNaMpesaOnline(data: stkpushinterface): Promise<{}>;
    reversal(data: reversalinterface): Promise<{}>;
    accountBalance(data: accountbalanceinterface): Promise<{}>;
    private authenticate;
    private generateSecurityCredential;
}
