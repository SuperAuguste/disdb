# disdb

Storing data on Discord!

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
