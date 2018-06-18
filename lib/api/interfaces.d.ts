export interface b2cinterface {
    InitiatorName: String;
    Amount: Number;
    PartyA: String;
    PartyB: String;
    QueueTimeOutURL: String;
    ResultURL: String;
    CommandID?: String;
    Occasion?: String;
    Remarks?: String;
}
export interface b2binterface {
    InitiatorName: String;
    Amount: Number;
    PartyA: String;
    PartyB: String;
    AccountReference: any;
    QueueTimeOutURL: String;
    ResultURL: String;
    CommandID?: String;
    SenderIdentifierType?: Number;
    RecieverIdentifierType?: Number;
    Remarks?: String;
}
export interface accountbalanceinterface {
    Initiator: String;
    PartyA: String;
    IdentifierType: any;
    QueueTimeOutURL: String;
    ResultURL: String;
    CommandID?: String;
    Remarks?: String;
}
export interface transactionstatusinterface {
    Initiator: String;
    TransactionID: String;
    PartyA: String;
    IdentifierType: any;
    ResultURL: String;
    QueueTimeOutURL: String;
    CommandID?: String;
    Remarks?: String;
    Occasion?: String;
}
export interface reversalinterface {
    Initiator: String;
    TransactionID: String;
    Amount: Number;
    ReceiverParty: String;
    ResultURL: String;
    QueueTimeOutURL: String;
    CommandID?: String;
    RecieverIdentifierType?: Number;
    Remarks?: String;
    Occasion?: String;
}
export interface stkpushinterface {
    BusinessShortCode: Number;
    Amount: Number;
    PartyA: String;
    PhoneNumber: String;
    CallBackURL: String;
    AccountReference: String;
    passKey: any;
    TransactionType?: String;
    TransactionDesc?: String;
}
export interface stkqueryinterface {
    BusinessShortCode: Number;
    CheckoutRequestID: String;
    passKey: any;
}
export interface c2bregisterinterface {
    ShortCode: Number;
    ConfirmationURL: String;
    ValidationURL: String;
    ResponseType?: String;
}
export interface c2bsimulateinterface {
    CommandID?: String;
    Amount: Number;
    Msisdn: Number;
    BillRefNumber: any;
    ShortCode: Number;
}
