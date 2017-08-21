const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');

app.use('/dist', express.static(path.join(__dirname, 'dist')));
app.use('/levels', express.static(path.join(__dirname, 'levels')));


app.get('/', (req, res) => {
  res.contentType('text/html');
  res.send(fs.readFileSync('index.html'));
});

app.listen(1234, () => {
  console.log('Listening to port 1234');
});
