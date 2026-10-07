
//  1  auto      the best available: sqlite on Node 22.5+, enginedb otherwise   (default)
//  2  sqlite    a SQLite file 
//  3  enginedb  light and fast
//  4  fusion    
//  5  spectral  
//  6  json      
//  7  text      
//  8  mysql     a MySQL server 
//  9  memory    nothing saved, gone on restart

export const database = {
  driver: "sqlite",

  options: {
    // Where the file drivers keep their file. Each driver has a sensible default
    // (./data/store.sqlite, ./data/store.edb, ...), so set this only to move it.
    // path: "./data/store.sqlite",

    // The mysql driver uses these instead (passed straight to mysql2).
    // host: "localhost",
    // user: "root",
    // password: "",
    // database: "mybot",
  },
};
