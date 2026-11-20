import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {migrateCoffeeGift} from './giftSchema.mjs';
test('coffee migration retains legacy cards, child ownership, unique keys and indexes',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec(`PRAGMA foreign_keys=ON;
   CREATE TABLE greetings(id TEXT PRIMARY KEY,idempotency_key TEXT UNIQUE,gift TEXT CHECK(gift IN ('none','flowers','book','tea')),bouquet_json TEXT,book_json TEXT);
   CREATE INDEX greetings_gift ON greetings(gift);
   CREATE TABLE participant_submissions(greeting_id TEXT PRIMARY KEY REFERENCES greetings(id),owner TEXT);
   INSERT INTO greetings VALUES('old','key','book',NULL,'{"title":"Book"}');
   INSERT INTO participant_submissions VALUES('old','student');`);
  const before={...db.prepare('SELECT * FROM greetings').get()};
  assert.equal(migrateCoffeeGift(db),true);
  assert.deepEqual({...db.prepare('SELECT * FROM greetings').get()},before);
  assert.equal(db.prepare('SELECT owner FROM participant_submissions').get().owner,'student');
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys,1);
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
  assert(db.prepare("SELECT name FROM sqlite_master WHERE name='greetings_gift'").get());
  db.exec("INSERT INTO greetings VALUES('new','coffee-key','coffee',NULL,NULL)");
  assert.throws(()=>db.exec("INSERT INTO greetings VALUES('bad','key','coffee',NULL,NULL)"));
  assert.throws(()=>db.exec("INSERT INTO greetings VALUES('bad','new-key','unknown',NULL,NULL)"));
  assert.equal(migrateCoffeeGift(db),false);
 }finally{db.close();}
});
test('failed foreign key audit rolls back the complete gift migration',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec(`PRAGMA foreign_keys=OFF; CREATE TABLE greetings(id TEXT PRIMARY KEY,gift TEXT CHECK(gift IN ('none','flowers','book','tea')));
   CREATE TABLE child(id TEXT REFERENCES greetings(id));INSERT INTO child VALUES('missing');PRAGMA foreign_keys=ON;`);
  assert.throws(()=>migrateCoffeeGift(db),/Foreign key check failed/);
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys,1);
  assert(!db.prepare("SELECT sql FROM sqlite_master WHERE name='greetings'").get().sql.includes("'coffee'"));
  assert(!db.prepare("SELECT name FROM sqlite_master WHERE name='greetings_coffee_upgrade'").get());
  db.exec("DELETE FROM child");assert.equal(migrateCoffeeGift(db),true);
 }finally{db.close();}
});
