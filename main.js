const booksStub = require("./stubs/booksStub.js");
const customersStub = require("./stubs/customersStub.js");
// const grpc = require("grpc");
const horusTracer = require("./horus/horus.js");

const book = {
  title: "ITttttt",
  author: "Stephen King",
  numberOfPages: 666,
  publisher: "Random House",
  bookId: 200,
};

const bookId = {
  bookId: 200,
};

const customer = {
  custId: 123,
  name: "Lily",
  age: 23,
  address: "Blablabla",
  favBookId: 200,
};

const customerId = {
  custId: 123,
};

let ht = new horusTracer("main");
// temp! user will specify the threshold for request processing times for now for any horus tracer object
// ht.threshold = 25;
// ht.neo4jInit("neo4j", "password");

function GetCustomer() {
  ht.start("customers");
  customersStub
    .GetCustomer(customerId, (error, response) => {
      if (error) console.log("there was an error ", error);
      ht.end();
      // ht.displayRequests();
      ht.writeToFile();
    })
    .on("metadata", (metadata) => {
      ht.grabTrace(metadata.get("response")[0]);
    });
}

function CreateCustomer() {
  ht.start("customers");
  customersStub
    .CreateCustomer(customer, (error, response) => {
      if (error) console.log("there was an error ", error);
      // console.log("response from createCustomer ", response);
      ht.end();
      // ht.displayRequests();
      ht.writeToFile();
    })
    .on("metadata", (metadata) => {
      ht.grabTrace(metadata.get("response")[0]);
    });
}

function DeleteCustomer() {
  ht.start("customers");
  customersStub
    .DeleteCustomer(customerId, (error, response) => {
      if (error) console.log("there was an error ", error);
      ht.end();
      // ht.displayRequests();
      ht.writeToFile();
    })
    .on("metadata", (metadata) => {
      ht.grabTrace(metadata.get("response")[0]);
    });
}

function CreateBook() {
  ht.start("books");
  booksStub
    .CreateBook(book, (error, response) => {
      if (error) console.log("there was an error ", error);
      ht.end();
      // ht.displayRequests();
      ht.writeToFile();
    })
    .on("metadata", (metadata) => {
      ht.grabTrace(metadata.get("response")[0]);
    });
}

function DeleteBook() {
  ht.start("books");
  booksStub
    .DeleteBook(bookId, (error, response) => {
      if (error) console.log("there was an error ", error);
      ht.end();
      // ht.displayRequests();
      ht.writeToFile();
    })
    .on("metadata", (metadata) => {
      ht.grabTrace(metadata.get("response")[0]);
    });
}

function GetBooks() {
  ht.start("books");
  booksStub
    .GetBooks({}, (error, response) => {
      if (error) console.log("there was an error ", error);
      ht.end();
      // ht.displayRequests();
      ht.writeToFile();
    })
    .on("metadata", (metadata) => {
      ht.grabTrace(metadata.get("response")[0]);
    });
}

function GetBookByID() {
  ht.start("books");
  booksStub
    .GetBooks(bookId, (error, response) => {
      if (error) console.log("there was an error ", error);
      // console.log("logging response inside getBookByID", response);
      ht.end();
      // ht.displayRequests();
      ht.writeToFile();
    })
    .on("metadata", (metadata) => {
      ht.grabTrace(metadata.get("response")[0]);
    });
}

// 1st -> Intra-service request !
// GetCustomer();
CreateCustomer();
// DeleteCustomer();
// CreateBook();
// DeleteBook();
// GetBooks();
// GetBookByID();