//SCRAPING MERCADONA

//PRUEBAS LOGFILE *************************************************************
import fs from 'fs'
import path from 'path'

//const directorioActual = "C:\\Users\\TB\\Desktop\\Work\\MarketVS\\WebScraper"
const directorioActual = ".\\"

const rutaArchivo = path.join(directorioActual, 'logfile.txt')
// ************************************************************************

// ****** IMPORTACIONES ******

//Uso puppeteer-extra en vez de puppeteer para no parecer un bot
import puppeteer from "puppeteer-extra" //Nos permite navegar por internet de manera automatizada con chromium/chrome (interactuar con la web, haciendo click, rellenando formularios...etc)

import StealthPlugin from 'puppeteer-extra-plugin-stealth' //Utilizo este middlewere junto a puppeteer-extra para no parecer un bot

//La variable executablePath se utiliza en los parametros del puppeteer.launch({aqui dentro}) mas abajo
import { executablePath } from "puppeteer" //Evitar error tras usar StealthPlugin

//Importo el modulo de la BBDD creado por mi (bbdd.js)
import {crearBBDD} from "./bbdd.js"


// ****** MIDDLEWARES ******

//Usamos StealthPlugin como un Middleware para no parecer un bot
puppeteer.use(StealthPlugin())


// ****** VARIABLES GLOBALES ******

//Uso de Puppetter
//Inicio puppeteer con una configuración / LANZO EL NAVEGADOR
const navegador = await puppeteer.launch({
    //headless:false, //Abre el navegador en vez de ejecutarse en segundo plano, vemos la UI
    //defaultViewport:false, //Al abrir el navegador se abre con las dimensiones correctas segun la pantalla
    executablePath:executablePath() //Evitar error tras usar StealthPlugin
    //Proxy:
    //args: [ '--proxy-server=51.158.154.173:3128', '--ignore-certificate-errors' ]
})

let categoriasPrincipales
let statusConexion = true
let contadorImagenes = 0

// *** TAREAS BBDD ***
//CREAR BBDD
let db = await setBBDD()
// *** CREAR COLECCION DENTRO DE LA BBDD ***
let coleccion = db.collection("mercadonaBBDD") 

// ****** COMIENZO CON LA EJECUCION DEL SCRAPING ******

//Abrimos una nueva pagina despues de lanzar el navegador
const pagina = await navegador.newPage()


// *** EJECUTO LA FUNCION PRINCIPAL ***
scraping()


// ****** FUNCION PRINCIPAL ******

async function scraping(){

    // PRUEBAS LOGFILE ****************************************************************** *

    // Crear el archivo
    fs.writeFileSync(rutaArchivo, '')

    //****************************************************************** */
    
    // *** NAVEGACION HASTA PAGINA CON PRODUCTOS ***
    //En la nueva pagina creada anteriormente  en el navegador, abrimos la URL a la que queremos navegar.
    await pagina.goto('https://www.mercadona.es/')

    // * PAGINA 1 (INICIO) *
    //Esperamos a que cargue el selector a usar (en este caso el input del codigo postal)
    await pagina.waitForSelector('div.input-text input')
    //Escribimos el codigo postal en el input definido:
    await pagina.type('div.input-text input', '46960')

    //Hago click a el boton del formulario correspondiente a el inputn de arriba
    await pagina.click('[type=submit]')

    //Espero a que la web cargue
    await pagina.waitForNavigation({
        waitUntil: 'networkidle0'
    })

    //Rechazar COOKIES (Si no rechazas/aceptas las cookies es posible que en el futuro de problemas al hacer click en botones)
    // Espera a que el botón sea visible en la página
    await pagina.waitForSelector('div.cookie-banner div.cookie-banner__actions button')
    // Obtiene todos los botones dentro del contenedor especificado
    const botones = await pagina.$$eval('div.cookie-banner div.cookie-banner__actions button', buttons => buttons.map(button => button.textContent.trim()))
    // Busca el índice del botón con el texto deseado
    const indice = botones.findIndex(texto => texto === 'Rechazar')
    // Si se encuentra el botón, haz clic en él
    if (indice !== -1) {
        const botonesSeleccionados = await pagina.$$('div.cookie-banner div.cookie-banner__actions button')
        await botonesSeleccionados[indice].click()
    } else {
        console.error('No se encontró el botón con el texto "Rechazar".')
    }


    // * PAGINA 2(Desde aqui entramos a categorias) *
    await pagina.click('#root header.header nav.menu a.menu-item')

    
    //Espero a que la web cargue
    await pagina.waitForNavigation({
        waitUntil: 'networkidle0'
    })

    categoriasPrincipales = await obtenerCategorias()


    // *** OBTENGO PRODUCTOS (Ejecuto la funcion que scrapea la pagina para obtener los productos) ***
    await almacenarProductos()

    console.log("Productos Almacenados")

    //CIERRO EL NAVEGADOR
    await navegador.close()

    //CIERRO CONEXIÓN CON BBDD
    await db.close()

    //FINALIZO EJECUCIÓN DEL SCRIPT (ctrl + c)
    // Finaliza el proceso de Node.js después de cerrar todo
    process.exit()
}


// ****** FUNCIONES ******

//Las funciones se lanzan una vez estas dentro de la pagina donde estan los productos

//Funcion principal a la hora de leer el DOM y sacar los productos (esta funcion llama a las demas funciones y almacena los datos en la BBDD).
async function almacenarProductos(){

    //Variables
    let subCategorias //Array que almacena las subcategorias

    //FOR CATEGORIAS PRINCIPALES
    //For que recorre todas las categorias principales
    for(let x = 0; x<=categoriasPrincipales.length-1; x++){

        //LOGFILE
        console.log("CATEGORIA NUMERO: " + x)
        console.log("Procesando Categoria ********" + categoriasPrincipales[x] + "********")
        
        //Esperamos a que cargue la categoria numero 1 (si no lo esperamos, salta directamente a la categoria 2 (agua))
        await pagina.waitForTimeout(500)

        // *** OBTENGO LAS SUBCATEGORIAS DE LA CATEGORIA PRINCIPAL ACTUAL EN EL FOR ***
        subCategorias = await obtenerSubCategorias()

        //FOR SUBCATEGORIAS
        //For que recorre todas las subcategorias de dentro de una categoria principal
        for(let i = 0; i <= subCategorias.length-1; i++){

            // Bucle que verifica la conexión periódicamente
            while (!(await verificarConexion())) {
                statusConexion = false
                fs.appendFileSync(rutaArchivo, 'ERROR CONEXION')
                fs.appendFileSync(rutaArchivo, '\n')
                console.log("ESPERANDO A RECUPERAR CONEXIÓN....")
                // Si no hay conexión, espera 5 segundos antes de volver a verificar
                await new Promise(resolve => setTimeout(resolve, 5000))
            }

            if(!statusConexion){ //Si se perdio la conexión, recargamos la pagina
                await pagina.waitForTimeout(250)
                await pagina.reload()
                await pagina.waitForTimeout(2000)
                statusConexion = true
            }

            console.log("Descargando Imagenes Subcategoria: " + subCategorias[i])

            let urlActual = pagina.url()
            console.log("PRUEBA URL: ")
            console.log(urlActual)

            // ************ DESCARGA DE IMAGENES PRODUCTOS SUBCATEGORIA *************
            let arrayImagenesURL = []
            let arrayImagenes = []
            // Esperar a que los elementos de botón con imágenes estén disponibles
            const buttonSelectors = await pagina.$$('.product-cell__content-link')
            // Iterar sobre cada elemento de botón y extraer la URL de la imagen
            for (const buttonSelector of buttonSelectors) {
                const imageUrl = await buttonSelector.$eval('img', img => img.getAttribute('src'))
                arrayImagenesURL.push(imageUrl)
            }
            //Descargar las imagenes una a una
            for (let x = 0; x<=arrayImagenesURL.length-1; x++){
                await pagina.goto(arrayImagenesURL[x], { waitUntil: 'networkidle0' })

                // Obtener el contenido de la imagen como buffer
                const imageBuffer = await pagina.screenshot({ type: 'png' })

                // Guardar el buffer como archivo de imagen en el sistema
                arrayImagenes.push(".\\src\\fotosMercadona\\" + contadorImagenes + ".png")
                fs.writeFileSync(".\\src\\fotosMercadona\\" + contadorImagenes + ".png", imageBuffer)
                contadorImagenes = contadorImagenes + 1
            }

            await pagina.waitForTimeout(250)
            await pagina.goto(urlActual)
            await pagina.waitForTimeout(2000)

            console.log("Descargando Subcategoria: " + subCategorias[i])

            //Actualizo el DOM para que bajo se actualicen los productos y coja los correctos y no los de la anterior subcategoria
            let productosDOM = await pagina.$$('div.product-cell__info')

            let contadorProductos = 0
            // *** OBTIENE PRODUCTOS UNO A UNO ***
            //Bucle que obtiene uno a uno los elementos indicados del DOM (variable productosDOM)
            for (let elemento of productosDOM){
                //Pausa para descansar entre insertar un producto y otro
                await pagina.waitForTimeout(250)
                try{
                    //Sacamos todos los H4 de el div sacado anteriormente y los pasamos a texto
                    let titulo = await pagina.evaluate((el) => el.querySelector("h4").textContent, elemento)
                    let precio = await pagina.evaluate((el) => el.querySelector("div.product-price > p").textContent, elemento)
                    
                    let precioDescuento = " "
                    try{
                        precioDescuento = await pagina.evaluate((el) => el.querySelector("div.product-price > p.product-price__unit-price.subhead1-b.product-price__unit-price--discount").textContent, elemento)
                    }catch(error){
                        precioDescuento = " "
                    }

                    //Variables necesarias para darle un formato al string con el formato del producto
                    //Es posible que no indique formato asi que las declaramos como string con un espacio
                    let formatoRecipiente = " "
                    let cantidadFormato = " "
                    //Variable final para formato
                    let formato = " "

                    //Utilizo try/catch ya que  es posible que no haya campo formato en un producto y por ende no se almacene
                    //Usando try/catch me aseguro de que aun que no haya formato, el producto se almacene igual pero con los campos en blanco
                    try{
                        formatoRecipiente = await pagina.evaluate((el) => el.querySelector("div.product-format span.footnote1-r").textContent, elemento)
                        //Con :nth-child(2) le indicamos que de los span dentro del div, obtenga el segundo span ya que hay dos y con la de arriba solo pilla el primero
                        cantidadFormato = await pagina.evaluate((el) => el.querySelector("div.product-format > span:nth-child(2)").textContent, elemento)
                    }catch(error){
                        formatoRecipiente = await pagina.evaluate((el) => el.querySelector("div.product-format span.footnote1-r").textContent, elemento)
                        cantidadFormato = " "
                    }

                    //Rellenamos el string con el formato del producto para añadirselo al objeto producto junto a los demas valores
                    formato = formatoRecipiente + cantidadFormato

                    //Creo un objeto de nombre producto el cual tiene como atributos datos de cada producto escrapeado
                    let producto = {
                        "titulo": titulo,
                        "precio": precio,
                        "precioDescuento": precioDescuento,
                        "formato": formato,
                        "foto":arrayImagenes[contadorProductos],
                        "categoria":categoriasPrincipales[x],
                        "subcategoria":subCategorias[i],
                        "tienda": "Mercadona"
                    }

                    // *** TAREAS BBDD ***
                    //Inserto cada producto en la coleccion actual
                    try{
                        await coleccion.insertOne(producto)
                    }catch(error){
                        console.log("PRUEBA TRY CATCH")
                        console.log(error)
                    }

                    contadorProductos = contadorProductos + 1

                    // Escribir en el archivo logfile
                    fs.appendFileSync(rutaArchivo, producto.titulo)
                    fs.appendFileSync(rutaArchivo, '\n')

                    //Pausa para descansar entre insertar un producto y otro
                    await pagina.waitForTimeout(250)

                }catch(error){console.log(error)}
            }
                
            //Una vez sacados los productos de una sub categoria, le damos a el boton de siguiente sub categoria
            try{
                // Bucle que verifica la conexión periódicamente
                while (!(await verificarConexion())) {
                    statusConexion = false
                    fs.appendFileSync(rutaArchivo, 'ERROR CONEXION')
                    fs.appendFileSync(rutaArchivo, '\n')
                    console.log("ESPERANDO A RECUPERAR CONEXIÓN....")
                    // Si no hay conexión, espera 5 segundos antes de volver a verificar
                    await new Promise(resolve => setTimeout(resolve, 5000))
                }

                console.log("Conexion status: " + statusConexion)
                if(!statusConexion){ //Si se perdio la conexión, recargamos la pagina
                    await pagina.waitForTimeout(250)
                    await pagina.reload()
                    await pagina.waitForTimeout(2000)
                    statusConexion = true
                }

                await pagina.click('button.ui-button.ui-button--big.ui-button--secondary.ui-button--positive.category-detail__next-subcategory')
                
                //Espero que cargue la pagina
                console.log("-----------------------------------------------------------------")
                console.log("Cargando pagina subcategoria " + subCategorias[i+1] + "....") 
                await pagina.waitForTimeout(2000)
             
            }catch(error){}
        }

        //Una vez terminado de scrapear todas las subcategorias de una categoria principal, le damos a el boton de siguiente categoria
        try{
            // Bucle que verifica la conexión periódicamente
            while (!(await verificarConexion())) {
                statusConexion = false
                fs.appendFileSync(rutaArchivo, 'ERROR CONEXION')
                fs.appendFileSync(rutaArchivo, '\n')
                console.log("ESPERANDO A RECUPERAR CONEXIÓN....")
                // Si no hay conexión, espera 5 segundos antes de volver a verificar
                await new Promise(resolve => setTimeout(resolve, 5000))
            }

            console.log("Conexion status: " + statusConexion)
            if(!statusConexion){ //Si se perdio la conexión, recargamos la pagina
                await pagina.waitForTimeout(250)
                await pagina.reload()
                await pagina.waitForTimeout(2000)
                statusConexion = true
            }

            if(categoriasPrincipales[x] === 'Zumos'){
                console.log("Descarga total finalizada....")
            }else{
                let [link2] = await pagina.$x(`//label[text()="${categoriasPrincipales[x+1]}"]`)
                await link2.click()

                //Espero que cargue la pagina
                await pagina.waitForTimeout(2000)

                console.log("  ")
                console.log("************************************************************************")
                console.log("************************************************************************")
                console.log("Cargando pagina categoria ********" + categoriasPrincipales[x+1] + "********")
            }

        }catch(error){console.log(error)}
    }
}


//Funcion que se lanza en la funcion almacenarProductos() para obtener las categorias
async function obtenerCategorias(){

    //Obtenemos el DOM(Estructura HTML)
    let categoriasDOM = await pagina.$$('div.grid-layout__sidebar span.category-menu__header')

    //Variables
    let listaCategorias = [] //Lista-array donde se van a almacenar los nombres de cada una de las categorias

    //Bucle que obtiene uno a uno los elementos indicados del DOM (variable categoriasDOM)
    for (let categoriaDOM of categoriasDOM){
        try{
            //Sacamos todos los H4 de el div sacado anteriormente(DOM) y los pasamos a texto
            let categoria = await pagina.evaluate((el) => el.querySelector("label").textContent, categoriaDOM)
            //Inserto cada uno de los h4 (elementos del DOM) en el array listaCategorias
            listaCategorias.push(categoria)
        }catch(error){console.log(error)}
    }

    //Retorno el array listaCategorias
    return listaCategorias
}


//Funcion que se lanza en la funcion almacenarProductos() para obtener las sub categorias
async function obtenerSubCategorias(){

    //Obtenemos el DOM(Estructura HTML)
    let subCategoriasDOM = await pagina.$$('div.collapse li.subhead1-r.category-item')

    //Variables
    let listaSubCategorias = []//Lista-array donde se van a almacenar los nombres de cada una de las sub categorias

    //Bucle que obtiene uno a uno los elementos indicados del DOM (variable subCategoriasDOM)
    for (let subCategoriaDOM of subCategoriasDOM){
        try{
            //Sacamos todos los H4 de el div sacados anteriormente y los pasamos a texto
            let subCategoria = await pagina.evaluate((el) => el.querySelector("button.category-item__link").textContent, subCategoriaDOM)
            //Inserto cada uno de los h4 (elementos del DOM) en el array listaSubCategorias
            listaSubCategorias.push(subCategoria)
        }catch(error){console.log(error)}
    }
    
    //Retorno el array listaSubCategorias
    return listaSubCategorias
}

// Función para verificar la conexión a Internet
async function verificarConexion() {
    try {
        // Realiza una petición a una URL que sabes que siempre está disponible
        await fetch('https://www.google.com/', { method: 'HEAD' })
        console.log("HAY CONEXIÓN")
        return true // Hay conexión a Internet
    } catch (error) {
        console.log("SE PERDIO LA CONEXIÓN A INTERNET....")
        return false // No hay conexión a Internet
    }
}

//Funcion que llama a la funcion importada "crearBBDD()" para asi crear y conectarse a la BBDD
async function setBBDD(){
    let db = await crearBBDD()
    return db
}