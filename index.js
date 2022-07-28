var express = require('express');
var Web3 = require('web3');
const cors = require('cors');
const socketio = require('socket.io');
const http = require('http');
const { addUser, removeUser, getUser,
        getUsersInRoom } = require("./users");
const {ObjectId,MongoClient} = require('mongodb')
const Provider = require('@truffle/hdwallet-provider');
const abi = require('./utils/Bet.json');
require("dotenv").config();

const uri = process.env.URI;
const client = new MongoClient(uri);

var app = express();
const server = http.createServer(app);
const io = socketio(server);
app.use(cors());

app.use(express.json());

var port = process.env.PORT || 5000;

// var SmartContractAddress = "0x5CBc5735309FB70767f3820d9E561F1b74133473";
var SmartContractAddress = "0x583BfFcff11067F1E3783153a6009290E384b828";
var SmartContractABI = abi.abi;
var address = "0xE0Fe66A6b176fe90BF9f9178068de2Cf45944f8d"
var privatekey = process.env.PRIVATE_KEY;
var rpcurl = "https://polygon-mumbai.infura.io/v3/17bf0515a7b341c69b5010fee943b4c8";
// var rpcurl = "wss://rinkeby.infura.io/ws/v3/17bf0515a7b341c69b5010fee943b4c8";

client
  .connect()
  .then(() => {
    console.log("connected!");
  })
  .catch((err) => {
    console.log(err);
  });
app.get("/api/join/:roomId", async (req, res) => {
  const {roomId} = req.params;
  
  const db = client.db('test');
  const games = db.collection('games');
  console.log("Find game room", roomId);
  const game = await games.findOne({ _id: ObjectId(roomId)});
  console.log(game);
  res.send(game);
}) 

app.get("/api/games", async (req, res) => {
  const db = client.db("test");
  const collection = db.collection("games");
  const result = await collection.find({}).toArray();
  res.send(result);
})

app.post("/api/create-game", async (req, res) => {
    const { signerAddress,nickname,secondNickname,amount} = req.body;
    const over = false;
    const collection = client.db().collection("games");
    const response = await collection.insertOne({
        signerAddress,
        nickname,
        // secondNickname,
        amount, 
        over
    })
    const result = {
        id: response.insertedId
    }
    res.send(result);
})
app.post("/api/lobby/:roomId", async (req,res) => {
  const { secondSigner, secondNickname } = req.body;
  const {roomId } = req.params;
  const collection = client.db().collection("games");

  console.log(secondSigner)
  const updated = await collection.updateOne({_id: ObjectId(roomId)}, {
    $set: {secondSigner: secondSigner, secondNickname: secondNickname}
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
    var receipt = await myContract.methods.payment(winner, Web3.utils.toWei(String(bet), 'ether')).send({ from: address });

    console.log("After withdraw called: ");
    
    console.log("done with all things");
  } catch (error) {
    console.log(error);
  }
}

app.post("/api/withdraw/:roomId",async (req, res) => {

  const db = client.db("test");
  const collection = db.collection("games");
  const {roomId} = req.params;
  console.log("Find game room", roomId);
  const game = await collection.findOne({_id: ObjectId(roomId)});
  console.log('Game info: ', game);
  if(game.over === true){
    console.log("The money has been already sent to the winner!");
    const {firstAddress, secondAddress} = req.body;
    const { winner} = req.body;
    if(firstAddress && secondAddress) res.send(`The money has been already sent to wallet addresses`);
    if(winner) res.send(`The money has been already sent to ${winner.substr(0, 7)} address` );
    
  }
  else if(game.over === false){
    console.log("ROOM NOT OVER");
    const {draw} = req.body;
    console.log("Draw: ", draw);
    if(draw){
      console.log("Draw was detected")
      const updated = await collection.updateOne({_id: ObjectId(roomId)}, {
        $set: {over: true}
      })
      const {firstAddress, secondAddress, amount} = req.body;
      let winner = firstAddress;
      const bet = amount;
      await sendData({winner, bet});
      winner = secondAddress;
      await sendData({winner, bet});

      res.send("Ether was returned to balances");
    }else{
      console.log("Send money to winner");
      const { winner, amount } = req.body;
      const bet = amount - (amount * 0.1);
      const updated = await collection.updateOne({_id: ObjectId(roomId)}, {
        $set: {over: true}
      })
      console.log(winner, bet);
      await sendData({winner, bet});
      res.send("Cash was delivered!")
    }
    
  }
  
})

  io.on("connection", (socket) => {
    socket.on('join', ({ name, room }, callback) => {
 
        const { error, user } = addUser(
            { id: socket.id, name, room });
 
        if (error) return callback(error);
 
        
        socket.emit('message', { user: 'admin', text:
            `${user.name},
            welcome to room ${user.room}.` });
 
        // Broadcast will send message to everyone
        // in the room except the joined user
        socket.broadcast.to(user.room)
            .emit('message', { user: "admin",
            text: `${user.name}, has joined` });
 
        socket.join(user.room);
        
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        });
        callback();
    })
    // socket.on('draw', () => {
    //   const user = getUser(socket.id);
    //   // io.to(user.room).emit('message', {
    //   //   over: true
    //   // })
    //   socket.broadcast.to(user.room)
    //         .emit('status', {
    //           over:true
    //         });
      
    // })
    socket.on('disconnect', () => {
        const user = removeUser(socket.id);
        if (user) {
            io.to(user.room).emit('message',
            { user: 'admin', text:
            `${user.name} had left` });
        }
    })
 
})

server.listen(port, () => {
  console.log('Server has started!');
});
// app.listen(port);
console.log('listening on', port);