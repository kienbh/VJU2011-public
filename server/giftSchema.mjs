/** Expand the legacy CHECK while retaining cards, indexes and child references. */
export function migrateCoffeeGift(db) {
 const sql=db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='greetings'").get()?.sql;
 if(!sql||sql.includes("'coffee'"))return false;
 const old=/CHECK\s*\(\s*gift\s+IN\s*\(\s*'none'\s*,\s*'flowers'\s*,\s*'book'\s*,\s*'tea'\s*\)\s*\)/i;
 if(!old.test(sql))throw Error('Unrecognized greetings gift constraint; migration stopped.');
 const schema=sql.replace(/^CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["`\[]?greetings["`\]]?/i,'CREATE TABLE greetings_coffee_upgrade').replace(old,"CHECK(gift IN ('none','flowers','book','tea','coffee'))");
 const objects=db.prepare("SELECT sql FROM sqlite_master WHERE tbl_name='greetings' AND type IN ('index','trigger') AND sql IS NOT NULL").all();
 const columns=db.prepare('PRAGMA table_info(greetings)').all().map(c=>'"'+c.name.replaceAll('"','""')+'"').join(',');
 const foreignKeys=db.prepare('PRAGMA foreign_keys').get().foreign_keys;
 db.exec('PRAGMA foreign_keys=OFF');
 try{
  db.exec('BEGIN IMMEDIATE');
  db.exec(schema);
  db.exec(`INSERT INTO greetings_coffee_upgrade (${columns}) SELECT ${columns} FROM greetings`);
  db.exec('DROP TABLE greetings; ALTER TABLE greetings_coffee_upgrade RENAME TO greetings;');
  for(const object of objects)db.exec(object.sql);
  if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Foreign key check failed; coffee migration rolled back.');
  db.exec('COMMIT');
 }catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error;}
 finally{db.exec(`PRAGMA foreign_keys=${foreignKeys?'ON':'OFF'}`);}
 return true;
}
