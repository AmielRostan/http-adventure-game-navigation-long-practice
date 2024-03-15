const http = require('http');
const fs = require('fs');

const { Player } = require('./game/class/player');
const { World } = require('./game/class/world');

const worldData = require('./game/data/basic-world-data');
const { url } = require('inspector');

let player;
let world = new World();
world.loadWorld(worldData);

const server = http.createServer((req, res) => {

  /* ============== ASSEMBLE THE REQUEST BODY AS A STRING =============== */
  let reqBody = '';
  req.on('data', (data) => {
    reqBody += data;
  });

  req.on('end', () => { // After the assembly of the request body is finished
    /* ==================== PARSE THE REQUEST BODY ====================== */
    if (reqBody) {
      req.body = reqBody
        .split("&")
        .map((keyValuePair) => keyValuePair.split("="))
        .map(([key, value]) => [key, value.replace(/\+/g, " ")])
        .map(([key, value]) => [key, decodeURIComponent(value)])
        .reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {});
    }

    /* ======================== ROUTE HANDLERS ========================== */
    let routeMatched = false;
    // Phase 1: GET /
    if (req.method === 'GET' && req.url === '/') {
      const available = world.availableRoomsToString();

      let content = fs.readFileSync('./views/new-player.html', 'utf-8')
        .replace(/#{availableRooms}/g, available);

      res.setHeader('Content-Type', 'text/html');
      res.statusCode = 200;
      routeMatched = true;
      return res.end(content);
    }

    // Phase 2: POST /player
    if (req.method === 'POST' && req.url === '/player') {
      const { name, roomId } = req.body;
      const room = world.rooms[roomId];

      player = new Player(name, room);

      res.setHeader('Location', `/rooms/${roomId}`);
      res.statusCode = 302;
      routeMatched = true;
      return res.end();
    }

    // Phase 3: GET /rooms/:roomId
    if (req.method === 'GET' && req.url.startsWith('/rooms/')) {
      const urlParts = req.url.split('/');
      if(urlParts.length === 3) {
        const roomId = urlParts[2];
        console.log(urlParts);
        if(!isNaN(roomId)) {
          const room = world.rooms[roomId];

          let content = fs.readFileSync('./views/room.html', 'utf-8')
            .replace(/#{roomName}/g, room.name)
            .replace(/#{inventory}/g, player.inventoryToString())
            .replace(/#{roomItems}/g, room.itemsToString())
            .replace(/#{exits}/g, room.exitsToString());


          res.setHeader('Content-Type', 'text/html');
          res.statusCode = 200;
          routeMatched = true;
          return res.end(content);
        }
      }
    }

    // Phase 4: GET /rooms/:roomId/:direction
    if(req.method === 'GET' && req.url.startsWith('/rooms/')) {
      const urlParts = req.url.split('/');
      if(urlParts.length === 4) {
        const roomId = urlParts[2];
        const direction = urlParts[3];

        try {
          const room = player.move(direction[0].toLowerCase());
          res.setHeader('Location', `/rooms/${room.id}`);
          res.statusCode = 302;
          return res.end();
        } catch {
          res.setHeader('Location', `/rooms/${roomId}`);
          res.statusCode = 302;
          routeMatched = true;
          return res.end();
        }
      }
    }

    // Phase 5: POST /items/:itemId/:action
    if(req.method === 'POST' && req.url.startsWith('/items/')) {
      const urlParts = req.url.split('/');
      const itemId = urlParts[2];
      const action = urlParts[3];

      let errorMessage = null;

      try{
        switch(action) {
          case 'drop':
            player.dropItem(itemId);
            break;
          case 'eat':
              player.eatItem(itemId);
            break;
          case 'take':
            player.takeItem(itemId);
            break;
          default:
            break;
        }
      } catch (error) {
        errorMessage = error.message;
      }

      if (errorMessage) {
        const errorContent = fs.readFileSync('./views/error.html', 'utf-8')
          .replace(/#{errorMessage}/g, errorMessage);

        res.statusCode = 400; // Bad request status code
        res.setHeader('Content-Type', 'text/html');
        return res.end(errorContent);
      }

      res.setHeader('Location', `/rooms/${player.currentRoom.id}`);
      res.statusCode = 302;
      routeMatched = true;
      return res.end();
    }

    // Phase 6: Redirect if no matching route handlers
    if(!(player === undefined) && routeMatched === false) {
      res.setHeader('Location', `/rooms/${player.currentRoom.id}`);
      res.statusCode = 302;
      return res.end();
    }
  })
});

const port = 5000;

server.listen(port, () => console.log('Server is listening on port', port));
