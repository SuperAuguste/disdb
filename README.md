# disdb

Storing data on Discord!

# Bot Commands

- **/list**: see the files stored in disdb
- **/play <BOT_NAME>**: play a file from disdb in your channel!
- **/preview <FILENAME>**: see that file. we know you want to.
- **/record**
  - **/record <BOT_NAME> start**: start recording in the voice channel that you're in!
  - **/record <BOT_NAME> stop**: stop the recording and upload the recordings to disdb
- **/delete**
  - **/delete <FILENAME>**: wipes a file from disdb
  - **/delete**: delete all the files. like all of them.

# Web Interface

- **upload**: for when you want to host _The Room (No Sex Scenes)_ in a discord channel
- **delete**: kill that file
- **preview**: (try to) see that file
- **download**: yes, you can download _The Room_. enjoy, discord.

# Technical Stuff

## p2p

We tried p2p uploads. Tried would be the key word. It's almost there, we promise.

## .env

```
TOKEN=<YOUR_TOKEN>
PORT=8080
```

## Heroku

- Set up a heroku app
- `heroku config:set TOKEN=<YOUR_TOKEN> BASE_URL=<APP_BASE_URL>`

## Project Structure

### SRC

- **index.js** initializes the app, discord client, and the app endpoints.
- API Handlers live in **controllers.js**
- The main bot logic lives in **discord.js**
- Common functionality shared between the discord client and the api lives in **common.js**. This includes service-insensitive variables like the baseUrl and helpers like **uploadBuffer**.
