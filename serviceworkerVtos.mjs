
const MAIN_CACHE_NAME = "main-cache";
const CACHED_URLS = [
    "./index.html",
    "./styles/index.css",
    "./regVencimientos.mjs",
    "./favicon.png",
    "./fuse.basic.min.mjs",
    "./offline.html",
]

self.addEventListener("install", (ev)=>{
    const cachesAddedPromise = caches.open(MAIN_CACHE_NAME).then((cache)=>{
        return cache.addAll(CACHED_URLS);
    })
    ev.waitUntil(cachesAddedPromise);
    console.log("Service worker installed");
});

self.addEventListener("activate", _=>{
    console.log("Service worker activated");
});


self.addEventListener("fetch", (ev)=>{
    
    const controller = new AbortController();
    const abortSignal = controller.signal;

    const timeoutID = setTimeout(()=>{console.log("aborted"); controller.abort()}, 3000);

    ev.respondWith(
        fetch(ev.request, {signal: abortSignal})
        .then((fetched)=>{
            clearTimeout(timeoutID);
            //console.log("Fetch received");
            return fetched
        })
        .catch( async (err)=>{
            console.log("CATCHED FAILED FETCH", err)
            const cachedResponse = await caches.match(ev.request);
            if (cachedResponse) {
                //return new Response("Not available offline A", {status: 404})
                return cachedResponse;
            }
            else {
                const canRespondWithHtml = ev.request.headers.get("accept").includes("text/html");
                if (canRespondWithHtml) {
                    //return new Response("Not available offline B", {status: 404})
                    return caches.match("ofline.html"); // I am sure this part works fine, that this cache exists.
                }
            }
            return new Response("Not available offline", {status: 404})
        })
    );
});
