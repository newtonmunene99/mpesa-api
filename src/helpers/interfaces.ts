export interface credentialsinterface {
  client_key: string;
  client_secret: string;
  initiator_password: string;
  certificatepath?: string;
}

export interface b2cinterface {
  Initiator: string;
  Amount: number;
  PartyA: string;
  PartyB: string;
  QueueTimeOutURL: string;
  ResultURL: string;
  CommandID: "SalaryPayment" | "BusinessPayment" | "PromotionPayment";
  Occasion?: string;
  Remarks?: string;
}

export interface b2binterface {
  InitiatorName: string;
  Amount: number;
  PartyA: string;
  PartyB: string;
  AccountReference: any;
  QueueTimeOutURL: string;
  ResultURL: string;
  CommandID?: string;
  SenderIdentifierType?: number;
  RecieverIdentifierType?: number;
  Remarks?: string;
}
export interface accountbalanceinterface {
  Initiator: string;
  PartyA: string;
  IdentifierType: any;
  QueueTimeOutURL: string;
  ResultURL: string;
  CommandID: "AccountBalance";
  Remarks?: string;
}
export interface transactionstatusinterface {
  Initiator: string;
  TransactionID: string;
  PartyA: string;
  IdentifierType: any;
  ResultURL: string;
  QueueTimeOutURL: string;
  CommandID?: string;
  Remarks?: string;
  Occasion?: string;
}
export interface reversalinterface {
  Initiator: string;
  TransactionID: string;
  Amount: number;
  ReceiverParty: string;
  ResultURL: string;
  QueueTimeOutURL: string;
  CommandID: "TransactionReversal";
  RecieverIdentifierType?: number;
  Remarks?: string;
  Occasion?: string;
}
export interface stkpushinterface {
  BusinessShortCode: number;
  Amount: number;
  PartyA: string;
  PartyB: string;
  PhoneNumber: number;
  CallBackURL: string;
  AccountReference: string;
  passKey: any;
  TransactionType?: "CustomerPayBillOnline";
  TransactionDesc?: string;
}
export interface stkqueryinterface {
  BusinessShortCode: number;
  CheckoutRequestID: string;
  passKey: any;
}
export interface c2bregisterinterface {
  ShortCode: number;
  ConfirmationURL: string;
  ValidationURL: string;
  ResponseType: "Completed" | "Cancelled";
}
export interface c2bsimulateinterface {
  CommandID: "CustomerPayBillOnline" | "CustomerBuyGoodsOnline";
  Amount: number;
  Msisdn: number;
  BillRefNumber?: any;
  ShortCode: number;
}
