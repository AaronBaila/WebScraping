// ****** IMPORTACIONES ******
import { MongoClient } from "mongodb";

// ****** VARIABLES ******
const dbURL = "mongodb://127.0.0.1:27017" //Variable que almacena la URL de la BBDD

// ****** FUNCIONES ******
//Funcion que conecta con la BBDD y crea la BBDD
export async function crearBBDD(){
    let conexion = await MongoClient.connect(dbURL)
    let db = await conexion.db('productos')
    console.log("Conectado a la BBDD, con URL: " + dbURL)
    return db
}
