var express = require('express');
var Web3 = require('web3');
const cors = require('cors');
const {ObjectId,MongoClient} = require('mongodb')
const Provider = require('@truffle/hdwallet-provider');
const abi = require('./utils/Bet.json');
require("dotenv").config();

const uri = "mongodb+srv://baurma-admin:NKM9DVeH5!LiFyY@mongo.miikc.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri);

var app = express();
app.use(cors());
app.use(express.json());
var port = process.env.PORT || 8080;

var SmartContractAddress = "0x5CBc5735309FB70767f3820d9E561F1b74133473";
var SmartContractABI = abi.abi;
var address = "0xE0Fe66A6b176fe90BF9f9178068de2Cf45944f8d"
var privatekey = process.env.PRIVATE_KEY;
var rpcurl = "wss://rinkeby.infura.io/ws/v3/17bf0515a7b341c69b5010fee943b4c8";

client
  .connect()
  .then(() => {
    console.log("connected!");
  })
  .catch((err) => {
    console.log(err);
  });
app.get("/join/:roomId", async (req, res) => {
  const {roomId} = req.params;
  const db = client.db('test');
  const games = db.collection('games');
  console.log("Find game room", roomId);
  const game = await games.findOne({ _id: ObjectId(roomId)});
  console.log(game);
  res.send(game);
}) 

app.get("/games", async (req, res) => {
  const db = client.db("test");
  const collection = db.collection("games");

  const result = await collection.find({}).toArray();

  res.send(result);
})
app.post("/create-game", async (req, res) => {
    const { signerAddress,nickname,secondNickname,amount} = req.body;
    const collection = client.db().collection("games");
    const response = await collection.insertOne({
        signerAddress,
        nickname,
        secondNickname,
        // link,
        amount
    })
    const result = {
        id: response.insertedId
    }
    res.send(result);
})
app.post("/lobby/:roomId", async (req,res) => {
  const { secondSigner } = req.body;
  const {roomId } = req.params;
  const collection = client.db().collection("games");

  console.log(secondSigner)
  const updated = await collection.updateOne({_id: ObjectId(roomId)}, {
    $set: {secondSigner: secondSigner}
  })
  res.send("Updated");
})

const sendData = async ({winner, bet}) => {
  try {
    console.log("in function");
    var provider = new Provider(privatekey, rpcurl);
    var web3 = new Web3(provider);
    var myContract = new web3.eth.Contract(SmartContractABI, SmartContractAddress);
    console.log("Winner: ", winner);
    console.log("Bet amount: ", bet);
    console.log("Before withdraw called: ");
    var receipt = await myContract.methods.withdrawCash(winner, Web3.utils.toWei(String(bet), 'ether')).send({ from: address });

    console.log("After withdraw called: ");
    
    console.log("done with all things");
  } catch (error) {
    console.log(error);
  }
}

app.post("/withdraw", (req, res) => {
  const { winner, amount } = req.body;
  const bet = amount - (amount * 0.1);
  console.log(winner, bet);
  sendData({winner, bet});
})

app.listen(port);
console.log('listening on', port);