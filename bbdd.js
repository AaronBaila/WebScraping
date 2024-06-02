// ****** IMPORTACIONES ******
import { MongoClient } from "mongodb";

// ****** VARIABLES ******
//Variable que almacena la URL de la BBDD
//const dbURL = "mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+1.8.0"
const dbURL = "mongodb://localhost:27017"

//export let db //Variable que va almacenar la conexion con la BBDD

//****** Ejecucion de la funcion principal ******
//crearBBDD() //Llamo a la funcion que conecta con la BBDD y crea la BBDD

//Funcion que conecta con la BBDD y crea la BBDD
export async function crearBBDD(){
    let conexion = await MongoClient.connect(dbURL)
    let db = await conexion.db('productos')
    console.log("Conectado a la BBDD, con URL: " + dbURL)
    return db
}


// ****** FUNCIONES PRUEBA (APRENDIZAJE) ******

/*conexionBBDD()

export async function conexionBBDD(){
    await crearBBDD()
}*/

/*export async function insertarDatos(){
    let datosInsertados = await coleccion.insertOne(producto)
    console.log("Datos insertados correctamente: " + datosInsertados)
 }

export async function obtenerDatos(){
    let datos = await coleccion.find().toArray()
    console.log("DATOS: ")
    console.log(datos)
}

export async function deleteBBDD(){
    let res = await db.dropDatabase()
    console.log("BBDD Eliminada: " + res)
}


//FUNCIONES CON THEN Y CATCH EN VEZ DE ASYNC AWAIT

export function conexionBBDD(){
    MongoClient.connect(dbURL)
    .then(client =>{
        db = client.db('miDB')
        console.log("Conectado a la BBDD, con URL: " + dbURL)
        coleccion = db.collection("miColeccion")
    })
    .catch(error =>{console.log(error)})
}

export function insertarDatos(){
   coleccion.insertOne(producto)
    .then(results=>{
        console.log("Datos almacenados correctamente: " + results)
    })
    .catch(error =>{
        console.log(error)
    })
}

export function obtenerDatos(){
    coleccion.find().toArray()
    .then(results=>{
        console.log(results)
    })
    .catch(error =>{
        console.log(error)
    })
}

export function deleteBBDD(){
    db.dropDatabase()
    console.log("BBDD Eliminada")
}*/