const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const Filter = require('bad-words');

const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users');
const { generateMessage, generateLocationMessage } = require('./utils/messages');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const port = process.env.PORT || 3000
const publicDirectoryPath = path.join(__dirname, '../public')

/* Use middleware to setup static directory to serve */
app.use(express.static(publicDirectoryPath));

io.on('connection', socket => {
    console.log('New Websocket Connection');
    
    socket.on('join', (options, callback) => {
        const { error, user } = addUser({
            id: socket.id,
            ...options
        });

        if (error) {
            return callback(error);
        };

        // join is server only
        socket.join(user.room);

        // server (emit) -> client (recieve) - first welcoming message
        // io.to.emit, socket.broadcast.to.emit /* to emit to every client in the same chatroom */
        socket.emit('message', generateMessage("Admin", "Welcome"));
        socket.broadcast.to(user.room).emit('message', generateMessage("Admin", `${user.username} has joined!`));
        
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        });

        callback()
    });

    // client (emit) -> server (recieve) - client's posting
    socket.on('sendMessage', (message, callback) => {
        const filter = new Filter();
        const user = getUser(socket.id);
        
        if (filter.isProfane(message)) {
            socket.emit('message', generateMessage(user.username, 'Profanity is not allowed!!'));
            return callback('Profanity is not allowed!!');
        };
       
        // server (emit) -> client (recieve) - send the posting message to every client
        io.to(user.room).emit('message', generateMessage(user.username, message));
        callback();
    });

    socket.on('sendLocation', ({ latitude, longitude }, callback) => {
        const url = `https://google.com/maps?q=${latitude},${longitude}`;
        const user = getUser(socket.id);
        io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, url));
        callback();
    });

    socket.on('disconnect', () => {
        const user = removeUser(socket.id);

        if (user) {
            io.to(user.room).emit('message', generateMessage(`${user.username} has left!`));
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            });
        };
    });
});

server.listen(port, () => {
    console.log(`Server is up on port ${port}!`)
})


// server (emit) -> client (recieve) - countUpdated
// client (emit) -> server (recieve) - increment

// let count = 0;
// io.on('connection', (socket) => {
//     console.log('New Web Socket Connection!');

//     socket.emit('countUpdated', count);

//     socket.on('increment', () => {
//         count++;
//         // change from socket.emit to io.emit so all clients on different browser can see the update
//         io.emit('countUpdated', count)
//     })
// })


/* 
socket.emit('message', "this is a test"); //sending to sender-client only
socket.broadcast.emit('message', "this is a test"); //sending to all clients except sender
socket.broadcast.to('game').emit('message', 'nice game'); //sending to all clients in 'game' room(channel) except sender
socket.to('game').emit('message', 'enjoy the game'); //sending to sender client, only if they are in 'game' room(channel)
socket.broadcast.to(socketid).emit('message', 'for your eyes only'); //sending to individual socketid
io.emit('message', "this is a test"); //sending to all clients, include sender
io.in('game').emit('message', 'cool game'); //sending to all clients in 'game' room(channel), include sender
io.of('myNamespace').emit('message', 'gg'); //sending to all clients in namespace 'myNamespace', include sender
socket.emit(); //send to all connected clients
socket.broadcast.emit(); //send to all connected clients except the one that sent the message
socket.on(); //event listener, can be called on client to execute on server
io.sockets.socket(); //for emiting to specific clients
io.sockets.emit(); //send to all connected clients (same as

*/