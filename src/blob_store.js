const indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.OIndexedDB || window.msIndexedDB;
const IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.OIDBTransaction || window.msIDBTransaction;
const dbVersion = 3;

function openDb(name) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, dbVersion);

    request.onerror = e => {
      reject('Error creating/accessing IndexedDB', e);
    };

    request.onupgradeneeded = e => {
      console.log('onupgradeneeded');
      e.target.result.createObjectStore(name);
      resolve(e.target.result);
    };

    request.onsuccess = (e) => {
      console.log('onsuccess');
      const db = request.result;

      db.onerror = e => {
        console.error('DB error', e);
      };

      if (db.setVersion && db.version != dbVersion) {
        console.log('yo');

        db.setVersion(dbVersion).onsuccess = () => {
          console.log('yo2');
          db.createObjectStore(name);
          resolve(db);
        };
      } else {
        resolve(db);
      }
    };
  });
}

export default
class BlobStore {
  static open(store) {
    return openDb(store).then(db => new BlobStore(store, db));
  }

  constructor(store, db) {
    this.store = store;
    this.db = db;
  }

  create() {
    this.db.createObjectStore(this.db);
  }

  put(name, blob) {
    return new Promise((resolve, reject) => {
      const transaction = this.transaction(IDBTransaction.WRITE);
      const put = transaction.objectStore(this.store).put(blob, name);

      put.onsuccess = () => {
        resolve();
      };
    });
  }

  get(name) {
    return new Promise((resolve, reject) => {
      const transaction = this.transaction(IDBTransaction.READ);
      const get = transaction.objectStore(this.store).get(name);

      console.log(transaction.objectStore(this.store));
      console.log(get);
      get.onsucces = (event) => {
        console.log(event.target);
        resolve(event.target.result);
      };

      get.onerror = (e) => {
        console.log('error',e);
        reject();
      };
    });
  }

  transaction(type = IDBTransaction.READ) {
    return this.db.transaction([this.store], type);
  }
}

BlobStore.load = function load(name) {
  return function* (progress, done) {
    let store = null;

    BlobStore.open(name).then(s => store = s);

    while (store === null) {
      yield progress(0, 100, 'Setting up store');
    }

    yield done(store);
  }
}
