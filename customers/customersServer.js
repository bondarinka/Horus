// const PROTO_PATH = "../protos/customers.proto";
const path = require("path");
const PROTO_PATH = path.join(__dirname, "../protos/customers.proto");
const grpc = require("grpc");
const protoLoader = require("@grpc/proto-loader");
const express = require("express");
const controller = require("./customersController.js");
const horusTracer = require("../horus/horus.js");
const app = express();

const hT = new horusTracer("customers");

app.use(express.json());

//packageDefinition loads the protofile and defines some settings of how we want our data to load.
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  arrays: true,
});

/*
Load a gRPC package definition as a gRPC object hierarchy

@param packageDef — The package definition object

@return — The resulting gRPC object
*/
const customersProto = grpc.loadPackageDefinition(packageDefinition);

//uuid generates a unique identifier
//use this to generate id's for items in the database
const { v4: uuidv4 } = require("uuid");

const server = new grpc.Server();

server.addService(customersProto.CustomersService.service, {
  CreateCustomer: (call, callback) => {
    console.log("call to CreateCustomer");

    //sample will take the call information from the client(stub)
    const sampleAdd = {
      custId: call.request.custId,
      name: call.request.name,
      age: call.request.age,
      address: call.request.address,
      favBookId: call.request.favBookId,
    };

    console.log("data in create customer ", sampleAdd);

    //this actually sends data to customersController.
    controller.createCustomer(sampleAdd);

    let meta = new grpc.Metadata();
    meta.add("response", "none");
    call.sendMetadata(meta);

    callback(null, {
      custId: `completed for ${call.request.custId}`,
      name: `completed for ${call.request.name}`,
      age: `completed for ${call.request.age}`,
      address: `completed for ${call.request.address}`,
      favBookId: `completed for ${call.request.favBookId}`,
    });
  },
  GetCustomer: (call, callback) => {
    console.log("call to GetCustomer");
    controller.getCustomer(callback, call);
  },
  DeleteCustomer: (call, callback) => {
    console.log("call to DeleteCustomer");

    let meta = new grpc.Metadata();
    meta.add("response", "none");
    call.sendMetadata(meta);

    //logic to delete customer from Database
    controller.deleteCustomer(call.request.custId);

    callback(null, {});
  },
});

server.bind("127.0.0.1:6000", grpc.ServerCredentials.createInsecure());
console.log("customerServer.js running at http://127.0.0.1:6000");

console.log("call from customer server");

server.start();
