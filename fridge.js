const express = require("express");
const app = express();
const path = require("path");
const bodyParser = require("body-parser");
const axios = require('axios');
const portNumber = 3000;
process.stdin.setEncoding("utf8");

/* body parser middleware for post forms*/
app.use(bodyParser.urlencoded({ extended: false }));

/* directory where views are */
app.set("views", path.resolve(__dirname, "views"));
/* setting ejs as view engine */
app.set("view engine", "ejs");

/* configurate environment */
require("dotenv").config();
/* connection string */
const uri = process.env.MONGO_CONNECTION_STRING;
 /* database and collection */
const dbAndCol = {db: "fridgeDB", collection:"users"};
const { MongoClient, ServerApiVersion } = require('mongodb');

/* listen at portNumber */
app.listen(portNumber, () => {
    console.log(`Web server started and running at http://localhost:${portNumber}/`);
    process.stdout.write("Stop to shutdown the server: ");
});

/* Processing stdin */
process.stdin.on("readable", () => {
    let dataInput = process.stdin.read();
    if (dataInput !== null) {
        let command = dataInput.trim().toLowerCase();
        if (command === "stop"){
            console.log("Shutting down the server");
            process.exit(0)
        } else {
            console.log(`Invalid Command: ${command}`);
        }
        process.stdout.write("Stop to shutdown the server: ");
        process.stdin.resume();
    }
});
/*************************************** Configuration End ***************************************/

/* default page (index) */
app.get("/", (req, res) => {
    const arg = req.query.argument;
    let msg = "";
    if (arg === "exists"){
        msg = "Username already exists";
    } else if (arg === "incorrect"){
        msg = "Incorrect username or password";
    }
    res.render("login", {msg});
});

/* default page (index) */
app.get("/signup", (req, res) => {
    res.render("signup");
});

/* redirect */
let user;
let groceries;
app.post("/redirect", (req, res) => {
    const {username, password, formIdentifier} = req.body;
    let signup = false;

    if (formIdentifier === "signupForm"){
        signup = true;
    }

    const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });
    (async () => {
        try {
            await client.connect();
            
            user = await lookUpOneEntry(client, dbAndCol, username);
            if (signup){
                if (user){
                    const argumentValue = "exists";
                    res.redirect(`/?argument=${argumentValue}`);
                    return;
                } else {
                    await insertUser(client, dbAndCol, {"username": username, "password": password, "groceries": []});
                    user = await lookUpOneEntry(client, dbAndCol, username);
                }
            } else if (!user || user.password !== password) {
                const argumentValue = "incorrect";
                res.redirect(`/?argument=${argumentValue}`);
                return;
            }
            groceries = user.groceries;
            res.redirect("/fridge")
        } catch (e) {
            console.error(e);
        } finally {
            await client.close();
        }
    })();
});

/* fridge page */
app.get("/fridge", (req, res) => {
    res.render("fridge", {groceries});
});

/* adding item */
app.post("/addItem", (req, res) => {
    const itemName = req.body.itemName;
    const quantity = parseInt(req.body.quantity, 10);
    const newItem = { [itemName]: quantity };
    groceries.push(newItem);
    res.redirect('/fridge');
});  

/* deleting item */
app.post("/deleteItem", (req, res) => {
    const i = req.body.index;
    groceries.splice(i, 1);
    res.redirect('/fridge');
});

/* saving grocery list to database */
app.post("/saveGroceries", (req, res) => {
    const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });
    (async () => {
        try {
            await client.connect();
            
            await updateOne(client, dbAndCol, user.username, groceries);
            
        } catch (e) {
            console.error(e);
        } finally {
            await client.close();
        }
    })();
    res.redirect('/fridge');
});

/* recipe api */
app.post("/recipe", (req, res) => {
    const food = req.body.food;
    let title; let ingredients; let servings; let instructions;
    const options = {
        method: 'GET',
        url: 'https://recipe-by-api-ninjas.p.rapidapi.com/v1/recipe',
        params: {
          query: food
        },
        headers: {
          'X-RapidAPI-Key': 'my_key',
          'X-RapidAPI-Host': 'recipe-by-api-ninjas.p.rapidapi.com'
        }
      };
    (async () => {
        try {
            const response = await axios.request(options);
	        const data = response.data[Math.floor(Math.random() * 10)];
            title = data.title; ingredients = data.ingredients; servings = data.servings; instructions = data.instructions;

            res.render("recipe", {title, ingredients, servings, instructions});
        } catch (e) {
            console.error(e);
        }
    })();
});

/* FUNCTIONS */
/* insert new user */
async function insertUser(client, dbAndCol, newUser) {
    await client.db(dbAndCol.db).collection(dbAndCol.collection).insertOne(newUser);
}

/* look up one entry that matches username */
async function lookUpOneEntry(client, dbAndCol, name) {
    let filter = {"username": name};
    const result = await client.db(dbAndCol.db)
                        .collection(dbAndCol.collection)
                        .findOne(filter);

   if (result) {
       return result;
   } else {
       return null;
   }
}

/* update grocery list of one user */
async function updateOne(client, dbAndCol, name, newList) {
    let filter = {"username" : name};
    let update = { $set: {"groceries": newList} };

    const result = await client.db(dbAndCol.db)
    .collection(dbAndCol.collection)
    .updateOne(filter, update);
}
