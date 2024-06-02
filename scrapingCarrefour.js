//SCRAPING CARREFOUR


//PRUEBAS LOGFILE *************************************************************
import fs from 'fs'
import path from 'path'

//const directorioActual = "C:\\Users\\TB\\Desktop\\Work\\MarketVS\\WebScraper"
const directorioActual = ".\\logfiles"

const rutaArchivo = path.join(directorioActual, 'logfileCarrefour.txt')
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
    headless:false, //Abre el navegador en vez de ejecutarse en segundo plano, vemos la UI
    defaultViewport:false, //Al abrir el navegador se abre con las dimensiones correctas segun la pantalla
    executablePath:executablePath() //Evitar error tras usar StealthPlugin
    //Proxy:
    //args: [ '--proxy-server=51.158.154.173:3128', '--ignore-certificate-errors' ] //En caso de que me banen la IP
})

let categoriasPrincipales = []
let subCategorias = []

// *** TAREAS BBDD ***
//CREAR BBDD
let db = await setBBDD()
// *** CREAR COLECCION DENTRO DE LA BBDD ***
let coleccion = db.collection("carrefourBBDD") 

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
    

    //En la nueva pagina creada anteriormente  en el navegador, abrimos la URL a la que queremos navegar.
    await pagina.goto('https://www.carrefour.es/')


    //Rechazar COOKIES
    await pagina.waitForSelector('#onetrust-reject-all-handler')
    await pagina.click('#onetrust-reject-all-handler')
    await pagina.waitForTimeout(1000)

    //Click en Menu
    await pagina.click('button.collage-menu__trigger.icon-menu-nav')

    //Click en Supermercado
    await pagina.waitForSelector('ul.collage-new-menu__list > li.menu-entry--first-level')
    await pagina.click('ul.collage-new-menu__list > li.menu-entry--first-level')

    categoriasPrincipales = await obtenerCategorias()

    await almacenarProductos()

    //CIERRO EL NAVEGADOR
    await navegador.close()

    //FINALIZO EJECUCIÓN DEL SCRIPT (ctrl + c)
    // Finaliza el proceso de Node.js después de cerrar todo
    process.exit()
}

async function almacenarProductos(){

    let finalPaginas = true
    let primeraEntrada = true

    //Click en la primera categoria principal
    await pagina.waitForSelector('ul.collage-new-menu__list > li.menu-entry--no-border:nth-child(2)')
    await pagina.click('ul.collage-new-menu__list > li.menu-entry--no-border:nth-child(2)')
    
    for(let x=0; x<=categoriasPrincipales.length-1;x++){
        console.log(" ******** Categoria ******** ")
        console.log(categoriasPrincipales[x])

        subCategorias = await obtenerSubcategorias()

        for(let i = 0; i<=subCategorias.length-1;i++){
            console.log(" ******** SubCategoria ******** ")
            console.log(subCategorias[i])

            if(primeraEntrada){
                //Click en Carniceria (primera subcategoria de la categoria principal)
                await pagina.waitForSelector('ul.collage-new-menu__list li.menu-entry--no-border:nth-child(2) a')
                await pagina.click('ul.collage-new-menu__list li.menu-entry--no-border:nth-child(2) a')
                await pagina.waitForSelector('div.product-card__detail')
                primeraEntrada = false
            }

            let numeroWhiles = 1
            finalPaginas = true

            while(finalPaginas){
                await pagina.waitForTimeout(3000)
                fs.appendFileSync(rutaArchivo, "While numero: " + numeroWhiles)

                // Simula el scroll hacia abajo para cargar los elementos 'lazy'
                await autoScroll(pagina);

                await pagina.waitForTimeout(500)

                //Obtengo los div que contienen todos los datos de un producto y que pertenezcan a el contenedor padre div.product-card-list
                //Si no especifico que obtenga solo los productos del contenedor padre, obtiene tambien los productos de oferta y por lo tanto habrian repetidos en la BBDD
                let contenedorPadre = await pagina.$('div.product-card-list')
                let productosDOM = await contenedorPadre.$$('div.product-card__detail')

                // *** OBTIENE PRODUCTOS UNO A UNO ***
                //Bucle que obtiene uno a uno los elementos indicados del DOM (variable productosDOM)
                for (let elemento of productosDOM){
                    //Pausa para descansar entre insertar un producto y otro
                    await pagina.waitForTimeout(250)
                    try{
                        //Sacamos todos los H4 de el div sacado anteriormente y los pasamos a texto
                        let titulo = await pagina.evaluate((el) => el.querySelector("a").textContent, elemento)
                        // Escribir en el archivo logfile
                        fs.appendFileSync(rutaArchivo, titulo)
                        fs.appendFileSync(rutaArchivo, '\n')
                        //let precio = await pagina.evaluate((el) => el.querySelector("div.product-price > p").textContent, elemento)
                        
                        //Creo un objeto de nombre producto el cual tiene como atributos datos de cada producto escrapeado
                        let producto = {
                            "titulo": titulo.trim(), //Uso .trim() para formatear la string de manera que elimine los espacios a la izquierda y a la derecha pero dejando intacto el contenido del string
                            "tienda": "Carrefour"
                        }

                        // *** TAREAS BBDD ***
                        //Inserto cada producto en la coleccion actual
                        try{
                            await coleccion.insertOne(producto)
                        }catch(error){
                            console.log("PRUEBA TRY CATCH")
                            console.log(error)
                        }

                    }catch(error){console.log(error)}    
                }

                try{
                    await pagina.click('div.pagination > div.pagination__container > div.pagination__row > a > span.pagination__next.icon-right-arrow-thin')
                }catch(error){
                    //No hay mas paginas que recorrer de esta Subcategoria, por lo que salimos del while
                    finalPaginas = false
                }

                numeroWhiles = numeroWhiles + 1

                //Prueba
                /*
                if(numeroWhiles === 3){
                    finalPaginas = false
                }*/

            }

            //Pasamos a la siguiente subcategoria
            if(i+3 !== subCategorias.length-1){
                await pagina.click('div.nav-first-level-categories__slide:nth-child('+(i+3)+') > a') //.nav-first-level-categories__list-element.ripple > span.nav-first-level-categories__text
                await pagina.waitForTimeout(1000)
            }else{
                console.log("Subcategorias terminadas")
            }  
        }

        if(x+2 <= categoriasPrincipales.length-1){
            //Click en Menu
            await pagina.click('button.collage-menu__trigger.icon-menu-nav')

            //Click en Supermercado
            await pagina.waitForSelector('ul.collage-new-menu__list > li.menu-entry--first-level')
            await pagina.click('ul.collage-new-menu__list > li.menu-entry--first-level')

            //Click en categoria principal
            await pagina.waitForSelector('ul.collage-new-menu__list > li.menu-entry--no-border:nth-child('+(x+2)+')')
            await pagina.click('ul.collage-new-menu__list > li.menu-entry--no-border:nth-child('+(x+2)+')')
        }else{
            console.log("SCRAPING TERMINADO")
        }
        
    }
}


async function obtenerCategorias(){
   // Espera a que el elemento que quieres interactuar esté disponible en la página
  await pagina.waitForSelector('ul.collage-new-menu__list li.menu-entry--no-border span.menu-entry__item__text')

  // Extrae el contenido de todas las etiquetas <span> dentro de la lista
  let categoriasPrincipales = await pagina.evaluate(() => {
    let spanElements = document.querySelectorAll('ul.collage-new-menu__list li.menu-entry--no-border span.menu-entry__item__text')
    let titulosCategorias = []
    spanElements.forEach(span => {
        titulosCategorias.push(span.textContent.trim());
    });
    return titulosCategorias
  });

  return categoriasPrincipales
}


async function obtenerSubcategorias(){
    // Espera a que el elemento que quieres interactuar esté disponible en la página
   await pagina.waitForSelector('ul.collage-new-menu__list li.menu-entry.menu-entry--no-border div.menu-entry__item a.anchor span.menu-entry__item__text')
 
   // Extrae el contenido de todas las etiquetas <span> dentro de la lista
   let subCategorias = await pagina.evaluate(() => {
     let spanElements = document.querySelectorAll('ul.collage-new-menu__list li.menu-entry.menu-entry--no-border div.menu-entry__item a.anchor span.menu-entry__item__text')
     let titulosSubcategorias = []
     spanElements.forEach(span => {
         titulosSubcategorias.push(span.textContent.trim());
     });
     return titulosSubcategorias
   });
 
   return subCategorias
}

//Scroll que permite cargar los productos LAZY
async function autoScroll(pagina) {
    await pagina.evaluate(async () => {
        await new Promise((resolve, reject) => {
            let totalHeight = 0
            const distance = 100 // Distancia de scroll en píxeles

            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight
                window.scrollBy(0, distance)
                totalHeight += distance

                if (totalHeight >= scrollHeight) {
                    clearInterval(timer)
                    resolve()
                }
            }, 100) // Intervalo en milisegundos entre cada scroll
        })
    })
}

//Funcion que llama a la funcion importada "crearBBDD()" para asi crear y conectarse a la BBDD
async function setBBDD(){
    let db = await crearBBDD()
    return db
}