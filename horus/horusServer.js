const express = require("express");
const app = express();
const port = 3000;

app.use("/", (req, res) => {
  // &nbsp;&nbsp;res.send("Hello World");
});

app.listen(port, () => {
  console.log("Server listening on port " + port);
});
