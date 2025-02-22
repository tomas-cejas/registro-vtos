import Fuse from "./fuse.basic.min.mjs";

class Vencimiento {
    nombre;
    fecha;
    id;
    constructor(nombre, fecha) {
        this.nombre = nombre;
        this.fecha = fecha;
        this.id = `${fecha}: ${nombre}`;
    }
    toString() {
        return `${this.fecha}: ${this.nombre}`;
    }
}

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./serviceworkerVtos.mjs")
    .then((registration)=>{
        console.log("Service Worker registered with scope:", registration.scope);
    })
    .catch((err)=>{
        console.log("Service worker registration failed:", err);
    });
}

const search = document.getElementById("search");
const addVtoReturnButton = document.getElementById("add-vto-return");


const vencimientosDatabase = await (async ()=>{


    const OBJ_STORE_NAME = "vencimientos";

    const errorHandler = (ev)=> {
        console.error(ev.target.error)
    }

    // create database if doesn't exit
    function createDB() {
        return new Promise((resolve, reject)=>{
            const openRq = window.indexedDB.open("vencimientos-database");

            let hasRequiredUpgrade = false;

            openRq.onerror = (ev)=> {
                errorHandler(ev);
                reject();
            }

            openRq.onupgradeneeded = (ev)=> {
                console.log("Upgrading/creating database...");

                const db = ev.target.result;

                db.createObjectStore(OBJ_STORE_NAME, {keyPath: "id"});

                const upgradeTransaction = ev.target.transaction;

                upgradeTransaction.oncomplete = ()=> {
                    console.log("Done upgrading/creating.");
                    hasRequiredUpgrade = true;
                }
            }

            openRq.onsuccess = (ev)=> {
                const db = ev.target.result;    
                resolve([db, hasRequiredUpgrade]);
            }
        })
    }

    const [db, hasBeenUpdated] = await createDB();

    function store(vtosArray) {

        console.log("Storing...");

        return new Promise((resolve, reject)=> {

            const transaction = db.transaction(OBJ_STORE_NAME, "readwrite");

            transaction.onerror = (ev)=> {
                console.log("  Storing transaction error!:", ev.target.error);
                reject(ev.target.error);
            }

            const vtosStore = transaction.objectStore(OBJ_STORE_NAME);

            vtosArray.forEach((vto)=>{
                vtosStore.add(vto);
            });
            
            transaction.oncomplete = ()=> {
                console.log("  Storing transaction completed!");
                resolve();
            };
        });
    }

    function retrieveAll() {
        return new Promise((resolve, reject)=> {

            const transaction = db.transaction(OBJ_STORE_NAME);
            const vtosStore = transaction.objectStore(OBJ_STORE_NAME);

            const getVtosRequest = vtosStore.getAll();

            getVtosRequest.onerror = (ev)=> {
                errorHandler(ev);
                reject();
            };

            getVtosRequest.onsuccess = (ev)=> {
                resolve(ev.target.result);
            }
        });
    }

    function clear() {

        const clearTransaction = db.transaction(OBJ_STORE_NAME, "readwrite");
        const clearRequest = clearTransaction.objectStore(OBJ_STORE_NAME).clear();

        clearTransaction.oncomplete = ()=>{
            console.log(`Database cleared: ${OBJ_STORE_NAME}`);
        }
        clearTransaction.onerror = (err)=>{
            console.error("Error clearing products on database:", err);
        }
    }

    function remove(key) {
        const deleteTransaction = db.transaction(OBJ_STORE_NAME, "readwrite");
        const deleteRequest = deleteTransaction.objectStore(OBJ_STORE_NAME).delete(key);

        deleteTransaction.oncomplete = ()=>{
            console.log("Item removed.");
        }
        deleteTransaction.onerror = (err)=>{
            console.error("Error removing item from db:", err);
        }
    }

    return {
        db,
        retrieveAll,
        store,
        clear,
        remove,
    }
})();


const addVtoMenu = (()=>{
    
    const nameInput = document.getElementById("add-vto-name");
    const dateInput = document.getElementById("add-vto-fecha");

    const addButton = document.getElementById("add-vto");
    const returnButton = document.getElementById("add-vto-return");

    
    addButton.addEventListener("click", addVtoHandler);
    returnButton.addEventListener("click", hide);

    function focusNextInput(currentElem) {

        const tabIndex = currentElem.tabIndex;
        const next = document.body.querySelector(
            `[tabindex='${tabIndex+1}']`,
        );
        next.focus();    
    }
    function unHide() {
        document.getElementById("hide-when-searching").hidden = true;
        search.hidden = true;
    
        vtosGrid.hide();
    
        document.getElementById("add-vto-menu").hidden = false;
        nameInput.value = search.value;
    }
    function hide() {
        document.getElementById("hide-when-searching").hidden = false;
        search.hidden = false;
        
        vtosGrid.unHide();
    
        document.getElementById("add-vto-menu").hidden = true;
        
        search.value = "";
        search.dispatchEvent(new Event("input"));
        nameInput.value = "";
    }
    function addVtoHandler() {
    
        const name = nameInput.value;
        const date = dateInput.value;
    
        const outcomeDisplay = addVtoReturnButton.parentElement.insertAdjacentElement("afterend", document.createElement("div"));
    
        const vto = new Vencimiento(name, date);

        vencimientosDatabase.store([vto])
        .then((result)=>{

            allVtos.push(vto);
            allVtos.sort();
            fuse = fuseFromVtosArray(allVtos);
            
            vtosGrid.appendTile(vtosGrid.createTile(`${vto.fecha}: ${vto.nombre}`));

            outcomeDisplay.innerText = vto;
        })
        .catch((err)=>{
            console.error(err)
            outcomeDisplay.innerText = err
        });

    }

    return {
        nameInput,
        dateInput,
        addButton,
        returnButton,

        addProductHandler: addVtoHandler,
        hide,
        unHide,
    }
})();


const vtosGrid = (()=> {
    
    let tileStyle = "grid-tile-square";

    const addGridTileClassName = "add-grid-tile";
    const addVtoTile = document.createElement("div");
    addVtoTile.innerText = "Agregar vencimiento";
    addVtoTile.id = "add-vto-tile";
    addVtoTile.addEventListener("click", addVtoMenu.unHide);
    addVtoTile.classList.add(tileStyle, addGridTileClassName);

    const grid = document.getElementById("items-display-container");

    grid.addEventListener("click", (ev)=> {
        if (!ev.target.hasAttribute("data-is-tile")) return;

        const doDelete = window.confirm(`Borrar registro? (${ev.target.innerText})`);

        if (!doDelete) {
            return
        }

        function deleteVto(htmlElement) {

            const key = htmlElement.innerText;
            vencimientosDatabase.remove(key);

            const childIndex = Array.from(grid.children).indexOf(htmlElement);
            htmlElement.remove();
            allVtos.splice(childIndex, 1);
            fuse = fuseFromVtosArray(allVtos);            
        }

        deleteVto(ev.target);
    });

    return {
        element: grid,
        addVtoTile,

        hide() {
            this.element.style.display = "none";
            this.element.hidden = true;
        },
        unHide() {
            this.element.style.display = "grid";
            this.element.hidden = false;
        },
        enableAddVtoTile() {
            this.element.appendChild(this.addVtoTile);
        },
        disableAddVtoTile() {
            this.addVtoTile.remove();
        },
        clear() {
            this.element.innerHTML = "";
        },
        createTile(name) {
            const div = document.createElement("div");
            div.innerText = name;
            div.classList.add(tileStyle);
            div.setAttribute("data-is-tile", "true");
            return div;
        },
        appendTile(tile) {
            this.element.appendChild(tile);
        },
        fill(productsArray, maxAmount = Infinity) {
            this.clear();
            let i = 0;
            for (const product of productsArray) {
                if (i++ > maxAmount) return;

                this.appendTile(this.createTile(`${product.fecha}: ${product.nombre}`));

                if (product.nombre === "undefined") {
                    console.warn(productsArray)
                }
            }
        },
        setStyles(gridClassName, tileClassName) {

            this.element.className = gridClassName;
            tileStyle = tileClassName;
            addVtoTile.className = `${tileStyle} ${addGridTileClassName}`;

            for (const tile of this.element.children) {
                tile.className = tileStyle;
            }
        }
    }
})();

vtosGrid.setStyles("grid-strip", "grid-tile-strip");


const allVtos = await vencimientosDatabase.retrieveAll();

//convert retrieved objects to Vencimientos
allVtos.forEach((raw, i) => {allVtos[i] = new Vencimiento(raw.nombre, raw.fecha)});


allVtos.sort();

let fuse = fuseFromVtosArray(allVtos);

vtosGrid.fill(allVtos);

search.addEventListener("input", ()=>{
    
    const target = search.value;

    if (target === "") {
        vtosGrid.fill(allVtos);
        return;
    }

    vtosGrid.clear();

    vtosGrid.enableAddVtoTile();

    const result = fuse.search(target);
    const lim = Math.min(5, result.length);

    for (let i = 0; i < lim; i++) {
        const vto = allVtos[result[i].refIndex];
        vtosGrid.appendTile(vtosGrid.createTile(`${vto}`));
    }
});


search.hidden = false;


function fuseFromVtosArray(vtosArray) {
    const listaString = vtosArray.map(val=>val.toString())
    return new Fuse(listaString);
}


function downloadObjAsJson(obj, filename = "descarga") {
    const json = JSON.stringify(obj, null, 2);
    const blob = new Blob([json], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename + ".json";
    a.click();
    URL.revokeObjectURL(url);
}

search.addEventListener("focus", _=>{
    document.getElementById("hide-when-searching").hidden = true;
    //window.dispatchEvent(new Event("resize"));
});

let clickingOn = null;

document.addEventListener("mousedown", (ev)=>{
    clickingOn = ev.target;
});
document.addEventListener("mouseup", _=> {
    
    clickingOn = null;
    const searching = document.getElementById("hide-when-searching").hidden;
    const addingVto = !document.getElementById("add-vto-menu").hidden;

    if (document.activeElement !== search && searching && !addingVto) {
        document.getElementById("hide-when-searching").hidden = false;
        //search.dispatchEvent(new Event("blur")) // search.blur() doesn't seem to trigger the blur event
    }
})


function scrollToTop(target) {
    const rect = target.getBoundingClientRect();
    const spaceAbove = rect.top;
    console.log(window.innerHeight)
    console.log(spaceAbove)
    
    document.body.style.marginBottom = `${spaceAbove}px`;
    target.scrollIntoView({ behavior: "instant", block: "start" });
}


document.getElementById("delete-all").addEventListener("click", ()=>{
    const doDelete = window.confirm("Borrar todos los registros?");
    if (!doDelete) return;

    allVtos.length = 0;
    fuse = fuseFromVtosArray(allVtos);
    vencimientosDatabase.clear();
    search.dispatchEvent(new Event("input"))
})

document.getElementById("download").addEventListener("click", ()=>{
    downloadObjAsJson(allVtos.map(reg=>reg.toString()))
})


window.addEventListener("beforeinstallprompt", (ev) => {
    ev.preventDefault();
    const install = document.getElementById("install");

    install.hidden = false;

    install.addEventListener("click", async ()=>{
        console.log(ev)
        try {
            const result = await ev.prompt();
            console.log(result);
        } catch (error) {
            window.alert("Para poder instalar la app, por favor recargue la página e intente nuevamente.")
        }
    });
});
