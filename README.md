# gta2.js

First, make sure you have the [current version of nodejs](https://nodejs.org/en/).

Download the levels:

    wget -P levels http://gtamp.com/mapscript/_singleplayer/04_gta2files/extras/singleplayer/data/{wil,bil,ste}.{sty,gmp}

To install dependencies:

    npm install

For development:

    npm run watch

    # Open another shell and run:
    node server.js

For production:

    NODE_ENV=production npm run build
    node server.js
