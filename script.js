import { auth, provider, db } from "./firebase-config.js";
// Importaciones de Auth
import { 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
// Importaciones de Firestore
import { 
    collection, 
    doc, 
    updateDoc, 
    onSnapshot, 
    query, 
    orderBy, 
    getDoc, 
    setDoc, 
    arrayUnion, 
    increment,  // Función importada directamente
    getDocs 
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

// Referencias de Firestore
const moviesCollection = collection(db, "movies");
const USER_VOTES_COLLECTION = "user_votes"; 
const NUM_SHARDS = 10; 

// ---------- Variables DOM CORREGIDAS ----------
const loginGoogleBtn = document.getElementById("login-google-btn");
const logoutBtn = document.getElementById("logout-btn");
const userInfo = document.getElementById("user-info"); // P en el header

// Referencias antiguas (ocultas en el HTML)
const loginEmailBtn = document.getElementById("login-email-btn");
const emailInput = document.getElementById("email-input");
const passwordInput = document.getElementById("password-input");

const moviesContainer = document.getElementById("movies-container");
const players = {};
let currentUser = null; 
let allMoviesData = []; 

// ----------------------------------------------------
// 💡 FUNCIONES CLAVE DE SHARDING
// ----------------------------------------------------

/**
 * Retorna la referencia a un fragmento (shard) aleatorio para registrar el voto.
 */
function getRandomShardRef(movieId) {
    const randomShardIndex = Math.floor(Math.random() * NUM_SHARDS);
    const shardId = `shard_${randomShardIndex}`;
    return doc(db, "movies", String(movieId), "shards", shardId);
}

// ----------------------------------------------------

// Función para manejar el cierre de sesión con mensaje
async function logoutUser() {
    await signOut(auth);
    alert("Sesión cerrada. Solo se permite correo institucional UDABOL.");
}

// Detecta cambios de estado de autenticación - LÓGICA SIMPLIFICADA
onAuthStateChanged(auth, (user) => {
    currentUser = user; 

    if (user) {
        if (!user.email || !user.email.endsWith("@udabol.edu.bo")) {
            logoutUser();
            return;
        }

        // Usuario loggeado y verificado
        loginGoogleBtn.style.display = "none";
        logoutBtn.style.display = "inline-block";
        userInfo.textContent = `Bienvenido: ${user.email.split('@')[0]} 👋`;
        
        updateVoteButtonsState(); 
    } else {
        // Usuario no loggeado
        loginGoogleBtn.style.display = "inline-block";
        logoutBtn.style.display = "none";
        userInfo.textContent = "";
        
        if (allMoviesData.length > 0) renderMovies(); 
    }
    
    // Ocultar elementos de correo/contraseña
    if (loginEmailBtn) loginEmailBtn.style.display = "none";
    if (emailInput) emailInput.style.display = "none";
    if (passwordInput) passwordInput.style.display = "none";
});

// Función de Login (Google) - SE MANTIENE
loginGoogleBtn.addEventListener("click", async () => {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Error en Google Login:", error);
        alert("Error al iniciar sesión con Google.");
    }
});

// Logout
logoutBtn.addEventListener("click", () => {
    signOut(auth);
});

// ----------------------------------------------------
// 💡 METADATOS DE PELÍCULAS (Incluye Sinopsis Larga y Ficha Técnica)
// ----------------------------------------------------
const MOVIES_METADATA = [
    // 1
    {
        id: 1, title: "Hereditary (2018)", votes: 0,
        posterUrl: "https://m.media-amazon.com/images/M/MV5BNTEyZGQwODctYWJjZi00NjFmLTg3YmEtMzlhNjljOGZhMWMyXkEyXkFqcGc@._V1_.jpg",
        trailerUrl: "https://www.youtube.com/embed/7jMdzpZgqb4",
        description: "Un drama familiar se convierte en un descenso escalofriante: secretos, herencias malditas y un terror que te seguirá mucho después de los créditos.",
        sinopsis_larga: "Tras la muerte de la abuela, la familia Graham comienza a desentrañar secretos crípticos y cada vez más aterradores sobre su ascendencia. El terror se desata cuando descubren su destino ineludible y el legado maldito que heredaron, llevando a la madre, Annie, a una espiral de paranoia y horror sobrenatural.",
        director: "Ari Aster",
        duracion: "2h 7m",
        clasificacion: "R",
        cast: [
            { name: "Toni Collette" }, 
            { name: "Alex Wolff" },
            { name: "Milly Shapiro" }, 
            { name: "Gabriel Byrne" } 
        ],
        scenes: ["Rituales en la casa", "La escena del sótano", "El funeral"], videos: ["https://www.youtube.com/embed/VIDEO_ID"]
    },
    // 2
    {
        id: 2, title: "The Babadook (2014)", votes: 0,
        posterUrl: "https://m.media-amazon.com/images/M/MV5BMTk0NzMzODc2NF5BMl5BanBnXkFtZTgwOTYzNTM1MzE@._V1_FMjpg_UX1000_.jpg",
        trailerUrl: "https://www.youtube.com/embed/K4zB0Bff9JE",
        description: "Un libro infantil aparece en la casa y desata una presencia siniestra. Terror psicológico y una atmósfera sofocante que te hará dudar de todo lo que ves.",
        sinopsis_larga: "Amelia, una madre soltera agotada, lucha por lidiar con el miedo de su hijo problemático, Samuel, quien está aterrorizado por un monstruo que cree que los acecha. Cuando un misterioso libro infantil, 'The Babadook', aparece en su casa, Amelia se da cuenta de que la criatura sobre la que Samuel advierte podría ser real, o la manifestación de su propia locura y dolor.",
        director: "Jennifer Kent",
        duracion: "1h 34m",
        clasificacion: "NR",
        cast: [
            { name: "Essie Davis", photo: "https://via.placeholder.com/220x300?text=Essie+Davis" }, 
            { name: "Noah Wiseman", photo: "https://via.placeholder.com/220x300?text=Noah+Wiseman" },
            { name: "Daniel Henshall" }
        ],
        scenes: ["La aparición del libro", "Noche en la casa", "Confrontación final"], videos: ["https://www.youtube.com/embed/VIDEO_ID"]
    },
    // 3
    {
        id: 3, title: "Sinister (2012)", votes: 0,
        posterUrl: "https://m.media-amazon.com/images/M/MV5BNzdhMjUyZGEtZDBkOS00OTg3LTkwNDAtMjZmZTVjY2UyNGQ1XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        trailerUrl: "https://www.youtube.com/embed/qcXom7JNKA0",
        description: "Un escritor encuentra cintas que documentan asesinatos. A cada visionado el terror crece; algo ancestral observa desde la oscuridad. Susto tras susto, no podrás mirar atrás.",
        sinopsis_larga: "Ellison Oswalt, un escritor de crímenes reales en apuros, se muda con su familia a una casa donde ocurrió un asesinato terrible. Allí, encuentra una caja de viejas películas caseras que revelan que el asesinato en la casa es obra de algo mucho más grande y siniestro. Mientras investiga, su familia se convierte en el próximo objetivo de una entidad demoníaca.",
        director: "Scott Derrickson",
        duracion: "1h 50m",
        clasificacion: "R",
        cast: [
            { name: "Ethan Hawke", photo: "https://via.placeholder.com/220x300?text=Ethan+Hawke" },
            { name: "Juliet Rylance" },
            { name: "Fred Dalton Thompson" }
        ],
        scenes: ["Las cintas encontradas", "La casa del crimen", "La criatura en la filmación"], videos: ["https://www.youtube.com/embed/VIDEO_ID"]
    },
    // 4
    {
        id: 4, title: "The Exorcist (1973)", votes: 0,
        posterUrl: "https://i.pinimg.com/736x/53/c3/b8/53c3b8947d66948c3865a8f6c014c090.jpg",
        trailerUrl: "https://www.youtube.com/embed/BU2eYAO31Cc",
        description: "Clásico imbatible: posesión, fe y el choque entre lo humano y lo demoníaco. El miedo que definió una generación sigue intacto.",
        sinopsis_larga: "La actriz Chris MacNeil nota cambios dramáticos y violentos en su hija de 12 años, Regan. Después de que todos los tratamientos médicos fallan, recurre a dos sacerdotes, el Padre Karras y el Padre Merrin, para realizar un exorcismo, enfrentándose a una fuerza demoníaca ancestral que ha poseído a la niña.",
        director: "William Friedkin",
        duracion: "2h 12m",
        clasificacion: "R",
        cast: [
            { name: "Ellen Burstyn", photo: "https://via.placeholder.com/220x300?text=Ellen+Burstyn" }, 
            { name: "Max von Sydow", photo: "https://via.placeholder.com/220x300?text=Max+von+Sydow" },
            { name: "Linda Blair" },
            { name: "Jason Miller" }
        ],
        scenes: ["La primera convulsión", "El exorcismo", "La batalla final"], videos: ["https://www.youtube.com/embed/VIDEO_ID"]
    },
    // 5
    {
        id: 5, title: "Psycho (1960)", votes: 0,
        posterUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ7cwDJjSEMc0HD77BWXsGsXDLtLJqxFcLAUw&s",
        trailerUrl: "https://www.youtube.com/embed/mC2gOyWuSEY",
        description: "El viaje hasta el Motel Bates cambió el cine: suspense, giros psicológicos y una escalofriante atmósfera que todavía corta la respiración.",
        sinopsis_larga: "Marion Crane, una secretaria que ha robado 40.000 dólares de su empleador, se detiene para pasar la noche en el aislado Motel Bates, dirigido por el tímido pero amable Norman Bates. Lo que comienza como una breve parada se convierte en una pesadilla de suspense y horror psicológico cuando una serie de eventos violentos y misterios en torno a la madre de Norman salen a la luz.",
        director: "Alfred Hitchcock",
        duracion: "1h 49m",
        clasificacion: "R",
        cast: [
            { name: "Anthony Perkins", photo: "https://via.placeholder.com/220x300?text=Anthony+Perkins" }, 
            { name: "Janet Leigh", photo: "https://via.placeholder.com/220x300?text=Janet+Leigh" },
            { name: "Vera Miles" }
        ],
        scenes: ["Motel Bates", "La escena de la ducha", "Revelación final"], videos: ["https://www.youtube.com/embed/VIDEO_ID"]
    },
    // 6
    {
        id: 6, title: "The Shining (1980)", votes: 0,
        posterUrl: "https://horrorreviewsbythecollective.wordpress.com/wp-content/uploads/2019/05/ce31269da2ed56a33e18037b17d9bd4d.jpg",
        trailerUrl: "https://www.youtube.com/embed/IiSjPcRWjYA",
        description: "Un hotel aislado, invierno eterno y la locura que consume a una familia. Kubrick construyó un laberinto de terror visual que deja huella.",
        sinopsis_larga: "Jack Torrance, un aspirante a escritor y ex maestro, acepta el puesto de vigilante de invierno en el aislado Hotel Overlook en Colorado. Se muda con su esposa Wendy y su hijo Danny, quien posee habilidades psíquicas. A medida que el invierno avanza y la familia queda aislada, las fuerzas sobrenaturales del hotel comienzan a influir en Jack, llevándolo lentamente a la locura asesina.",
        director: "Stanley Kubrick",
        duracion: "2h 26m",
        clasificacion: "R",
        cast: [
            { name: "Jack Nicholson", photo: "https://via.placeholder.com/220x300?text=Jack+Nicholson" }, 
            { name: "Shelley Duvall", photo: "https://via.placeholder.com/220x300?text=Shelley+Duvall" },
            { name: "Danny Lloyd" }
        ],
        scenes: ["El laberinto nevado", "Here’s Johnny!", "Visiones en el pasillo"], videos: ["https://www.youtube.com/embed/VIDEO_ID"]
    },
    // 7
    {
        id: 7, title: "Rosemary’s Baby (1968)", votes: 0,
        posterUrl: "https://assets.blogs.bsu.edu/wp-content/uploads/sites/25/2020/01/14141820/rosemarys-baby-1968-1.jpg",
        trailerUrl: "https://www.youtube.com/embed/VIDEO_ID",
        description: "Paranoia y conspiración en el corazón de la maternidad. Una mujer sola en la ciudad descubre que sus vecinos esconden algo impensable.",
        sinopsis_larga: "Rosemary Woodhouse y su esposo Guy, un actor en ascenso, se mudan a un elegante apartamento en Nueva York, a pesar de las advertencias sobre su oscuro pasado. Cuando Rosemary queda embarazada, sus vecinos, los extrañamente dulces Castevet, comienzan a inmiscuirse demasiado. Rosemary se convence de que su embarazo es parte de una conspiración satánica tramada por sus vecinos y su propio esposo.",
        director: "Roman Polanski",
        duracion: "2h 17m",
        clasificacion: "R",
        cast: [
            { name: "Mia Farrow", photo: "https://via.placeholder.com/220x300?text=Mia+Farrow" },
            { name: "John Cassavetes" },
            { name: "Ruth Gordon" }
        ],
        scenes: ["Vecinos sospechosos", "El embarazo", "El descubrimiento final"], videos: ["https://www.youtube.com/embed/pwLKIcB0zDw"]
    },
    // 8
    {
        id: 8, title: "The Texas Chain Saw Massacre (1974)", votes: 0,
        posterUrl: "https://www.hawaiitheatre.com/wp-content/uploads/2025/09/TheTexasChainSawMassacre_700.png",
        trailerUrl: "https://www.youtube.com/embed/74f1cJYQZoU",
        description: "Carne, polvo y horror: un clásico crudo y salvaje que redefinió el horror de supervivencia. No es bonito — es visceral.",
        sinopsis_larga: "Cinco jóvenes en un viaje por Texas caen en la trampa de una familia de caníbales dementes, entre ellos el icónico Leatherface. La película es un terror crudo y sin concesiones que sigue la lucha desesperada por la supervivencia de la protagonista, Sally Hardesty, en una de las casas más terroríficas de la historia del cine.",
        director: "Tobe Hooper",
        duracion: "1h 23m",
        clasificacion: "R",
        cast: [
            { name: "Marilyn Burns", photo: "https://via.placeholder.com/220x300?text=Marilyn+Burns" },
            { name: "Gunnar Hansen" }
        ],
        scenes: ["La granja siniestra", "La persecución", "La confrontación final"], videos: ["https://www.youtube.com/embed/VIDEO_ID"]
    },
    // 9
    {
        id: 9, title: "Alien (1979)", votes: 0,
        posterUrl: "https://www.originalfilmart.com/cdn/shop/products/alien_1979_german_a1_original_film_art_5000x.jpg",
        trailerUrl: "https://www.youtube.com/embed/Eu9ZFTXXEiw",
        description: "Un viaje espacial que se convierte en pesadilla: diseño corporal, tensión y un alienígena que redefine el terror en el vacío.",
        sinopsis_larga: "La tripulación del remolcador espacial comercial Nostromo investiga una señal de socorro en un planeta remoto. Uno de los miembros es atacado por una forma de vida extraterrestre. Una vez a bordo, la criatura parasitaria madura rápidamente, convirtiéndose en el perfecto depredador, y la teniente Ellen Ripley debe luchar por la supervivencia de la tripulación restante.",
        director: "Ridley Scott",
        duracion: "1h 57m",
        clasificacion: "R",
        cast: [
            { name: "Sigourney Weaver", photo: "https://via.placeholder.com/220x300?text=Sigourney+Weaver" },
            { name: "Tom Skerritt" },
            { name: "Ian Holm" }
        ],
        scenes: ["La escena del huevo", "La criatura en la cabina", "La huida final"], videos: ["https://www.youtube.com/embed/VIDEO_ID"]
    },
    // 10
    {
        id: 10, title: "The Thing (1982)", votes: 0,
        posterUrl: "https://m.media-amazon.com/images/M/MV5BYTA3NDU5MWEtNTk4Yy00ZDNkLThmZTQtMjU3ZGVhYzAyMzU4XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        trailerUrl: "https://www.youtube.com/embed/2wOlQ4CUo-s",
        description: "Paranoia ártica y efectos grotescos: nadie puede confiar en nadie cuando la cosa lo copia todo. Terror de aislamiento en su mejor forma.",
        sinopsis_larga: "Un equipo de investigación estadounidense en la Antártida se encuentra con una criatura alienígena que puede asimilar y copiar perfectamente la forma de cualquier organismo vivo. El equipo, liderado por el piloto R.J. MacReady, debe luchar contra la paranoia y el aislamiento mientras intentan descubrir quién es humano y quién es la 'Cosa' antes de que infecte a toda la humanidad.",
        director: "John Carpenter",
        duracion: "1h 49m",
        clasificacion: "R",
        cast: [
            { name: "Kurt Russell", photo: "https://via.placeholder.com/220x300?text=Kurt+Russell" },
            { name: "Wilford Brimley" }
        ],
        scenes: ["La transformación", "El test de sangre", "El último refugio"], videos: ["https://www.youtube.com/embed/VIDEO_ID"]
    },
    // 11
    {
        id: 11, title: "Terrifier 2 (2022)", votes: 0,
        posterUrl: "https://imusic.b-cdn.net/images/item/original/537/5060262859537.jpg",
        trailerUrl: "https://www.youtube.com/embed/GQ0_lY23VAs",
        description: "Un payaso infernal regresa con escenas sangrientas y desafíos extremos para los límites del gore. No apta para corazones sensibles.",
        sinopsis_larga: "Tras su resurrección por una entidad siniestra, el Payaso Art regresa al condado de Miles para sembrar el caos en la noche de Halloween. Su objetivo es una adolescente y su hermano menor, quienes se ven obligados a luchar contra el monstruo sádico que convierte la violencia extrema en una forma de arte.",
        director: "Damien Leone",
        duracion: "2h 18m",
        clasificacion: "NR (Gore Extremo)",
        cast: [
            { name: "David Howard Thornton", photo: "https://via.placeholder.com/220x300?text=David+Howard+Thornton" },
            { name: "Lauren LaVera" }
        ],
        scenes: ["La masacre del payaso", "La escena del sótano", "El enfrentamiento final"], videos: ["https://www.youtube.com/embed/VIDEO_ID"]
    },
    // 12
    {
        id: 12, title: "Terrifier 3 (2024)", votes: 0,
        posterUrl: "https://m.media-amazon.com/images/M/MV5BNGQ1YjE4MzMtYzdkMC00Nzg1LWIxZjgtYWY5NWIwNTZkNGQ4XkEyXkFqcGc@._V1_.jpg",
        trailerUrl: "https://www.youtube.com/embed/Y2u6m2W428g",
        description: "Continuación del terror perturbador: más atmósfera, más violencia estilizada y el payaso que no perdona.",
        sinopsis_larga: "En esta esperada secuela, el Payaso Art aterroriza a los residentes de Miles County en vísperas de Navidad. Su presencia trae consigo más brutalidad y un nuevo nivel de horror psicológico y visual, con nuevas víctimas y giros sangrientos.",
        director: "Damien Leone",
        duracion: "1h 45m (Estimada)",
        clasificacion: "NR (Gore Extremo)",
        cast: [
            { name: "David Howard Thornton", photo: "https://via.placeholder.com/220x300?text=David+Howard+Thornton" },
            { name: "Lauren LaVera" }
        ],
        scenes: ["Nueva escena impactante", "Persecución urbana", "Cierre sangriento"], videos: ["https://www.youtube.com/embed/VIDEO_ID"]
    },
    // 13
    {
        id: 13, title: "Scary Movie 2 (2001)", votes: 0,
        posterUrl: "https://m.media-amazon.com/images/M/MV5BZjZlOTgzNmUtNjZlYS00NWFjLTg4ZDktMWY4NDIxMjVjZjdhXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        trailerUrl: "https://www.youtube.com/embed/NdnacU5sbcE",
        description: "Parodia que se ríe de todos los clichés del horror. Humor irreverente y referencias para quien busque reír y no solo gritar.",
        sinopsis_larga: "Un grupo de jóvenes universitarios son engañados para que pasen la noche en una mansión encantada bajo la excusa de un experimento científico. La mansión, plagada de espíritus y fenómenos paranormales, se convierte en el escenario de una parodia hilarante que se burla de éxitos del terror como 'The Exorcist', 'Poltergeist' y 'The Haunting'.",
        director: "Keenen Ivory Wayans",
        duracion: "1h 23m",
        clasificacion: "R",
        cast: [
            { name: "Anna Faris", photo: "https://via.placeholder.com/220x300?text=Anna+Faris" },
            { name: "Marlon Wayans" },
            { name: "Regina Hall" }
        ],
        scenes: ["Rutinas paródicas", "Momentos icónicos", "Gags finales"], videos: ["https://www.youtube.com/embed/VIDEO_ID"]
    },
    // 14
    {
        id: 14, title: "La maldición de Mary (2019)", votes: 0,
        posterUrl: "https://m.media-amazon.com/images/S/pv-target-images/9be7a860d393ed28fffce72335b634c6b3fb17cd7c3c0fc9c8d38e078089b349.jpg",
        trailerUrl: "https://www.youtube.com/embed/KZm3Zw0ith4",
        description: "Una cinta inquietante sobre secretos, rituales y la herencia de una maldición que se manifiesta de formas inesperadas.",
        sinopsis_larga: "David compra un barco antiguo y abandonado llamado Mary para usarlo en un viaje con su familia. Pronto, comienzan a ocurrir fenómenos extraños y la familia se da cuenta de que el barco lleva consigo una maldición ancestral y siniestra que amenaza con matarlos en medio del vasto océano.",
        director: "Michael Goi",
        duracion: "1h 25m",
        clasificacion: "R",
        cast: [
            { name: "Madison Iseman", photo: "https://via.placeholder.com/220x300?text=Madison+Iseman" },
            { name: "Gary Oldman" },
            { name: "Emily Mortimer" }
        ],
        scenes: ["Aparición en la casa", "Descubrimiento del rito", "Clímax oscuro"], videos: ["https://www.youtube.com/embed/VIDEO_ID"]
    },
    // 15
    {
        id: 15, title: "Maleficio (Incantation, 2022)", votes: 0,
        posterUrl: "https://images.justwatch.com/poster/293752939/s718/incantation.jpg",
        trailerUrl: "https://www.youtube.com/embed/4rjqOa7ZWjE",
        description: "Terror moderno en formato de prueba documental: rituales, prohibiciones y la sensación de que algo invisible te vigila.",
        sinopsis_larga: "En formato found footage y narrado directamente a la cámara, la película sigue a una madre que rompió un tabú religioso hace seis años al profanar un altar. Ahora, una poderosa maldición ancestral la persigue a ella y a su pequeña hija. Busca la manera de salvar a su hija del destino mortal que se cierne sobre ellas.",
        director: "Kevin Ko",
        duracion: "1h 50m",
        clasificacion: "NR",
        cast: [
            { name: "Lee Jae-in", photo: "https://via.placeholder.com/220x300?text=Lee+Jae-in" },
            { name: "Huang Sin-ting" }
        ],
        scenes: ["Ritual prohibido", "Efectos extraños", "La maldición persiste"], videos: ["https://www.youtube.com/embed/VIDEO_ID"]
    },
    // 16
    {
        id: 16, title: "Insidious: The Red Door (2023)", votes: 0,
        posterUrl: "https://m.media-amazon.com/images/M/MV5BYzI1ZjMxODctMTM4ZS00NGZhLWJiMjItZmI4ZDNiNWZlNTVjXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        trailerUrl: "https://www.youtube.com/embed/gp4Z6bZ5tVU",
        description: "El regreso a los terrores familiares del universo Insidious: puertas, mundos y pesadillas que vuelven a perseguir a la familia.",
        sinopsis_larga: "Diez años después de los eventos de las primeras películas, Josh y Dalton Lambert deben profundizar en el Más Allá (The Further) una vez más para enfrentar el oscuro pasado de su familia. Los demonios reprimidos regresan con fuerza, obligando a padre e hijo a confrontar la infame Puerta Roja y los horrores que se esconden detrás.",
        director: "Patrick Wilson",
        duracion: "1h 47m",
        clasificacion: "PG-13",
        cast: [
            { name: "Patrick Wilson", photo: "https://via.placeholder.com/220x300?text=Patrick+Wilson" },
            { name: "Ty Simpkins" },
            { name: "Rose Byrne" }
        ],
        scenes: ["La puerta roja", "El mundo oscuro", "Sacrificio final"], videos: ["https://www.youtube.com/embed/VIDEO_ID"]
    },
    // 17
    {
        id: 17, title: "The Farm (2018)", votes: 0,
        posterUrl: "https://m.media-amazon.com/images/M/MV5BNGMxYTYyZjMtNDFjYi00MDkyLTlhOTEtMzNlZGFlNWIyOTczXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        trailerUrl: "https://www.youtube.com/embed/ce-4-dK07sU",
        description: "Una familia descubre que la granja que heredó oculta terrores antiguos. Suspenso rural con atmósfera y tensión creciente.",
        sinopsis_larga: "Una joven pareja que viaja por la carretera se detiene en un remoto restaurante que resulta ser el matadero de una granja de carne humana. Son capturados e introducidos en un mundo de horror y supervivencia, donde los humanos son criados como ganado.",
        director: "Hans Stjernswärd",
        duracion: "1h 20m",
        clasificacion: "R",
        cast: [
            { name: "El elenco", photo: "https://via.placeholder.com/220x300?text=Actor" },
            { name: "Nora Jane Noone" },
            { name: "Aleksandar Popovic" }
        ],
        scenes: ["Sombras en la granja", "Descubrimiento nocturno", "Huida final"], videos: ["https://www.youtube.com/embed/VIDEO_ID"]
    },
    // 18
    {
        id: 18, title: "Hostel: Part III (2011)", votes: 0,
        posterUrl: "https://m.media-amazon.com/images/M/MV5BOTdhZTVmMDItZTE5MC00NWU2LTk0MDEtYWYzZjk5MTk1ODc1XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        trailerUrl: "https://www.youtube.com/embed/G-bpdsew5P0",
        description: "El terror de turismo extremo continúa: violencia explícita, decisiones morales y el nivel más bajo de hospitalidad imaginable.",
        sinopsis_larga: "Cuatro amigos viajan a Las Vegas para una despedida de soltero, pero terminan siendo atraídos a un juego mortal de la organización 'Elite Hunting'. En lugar de ser cazados en una 'hostel', los turistas ricos ahora apuestan y ven la tortura en vivo, obligando a las víctimas a luchar por su vida en un espectáculo macabro.",
        director: "Scott Spiegel",
        duracion: "1h 28m",
        clasificacion: "R",
        cast: [
            { name: "Elenco", photo: "https://via.placeholder.com/220x300?text=Actor" },
            { name: "Kip Pardue" },
            { name: "Brian Hallisay" }
        ],
        scenes: ["El secuestro", "La cámara de tortura", "Final traumático"], videos: ["https://www.youtube.com/embed/VIDEO_ID"]
    }
];

// ----------------------------------------------------

// Renderiza las películas (Tarjetas multimedia)
function renderMovies() {
    moviesContainer.innerHTML = "";
    allMoviesData.forEach((movie) => {
        const card = document.createElement("div");
        card.classList.add("movie-card");
        card.dataset.id = movie.id; 
        
        // Lógica de botones
        const buttonText = movie.hasVoted ? "Votado" : "Votar";
        const buttonDisabled = !currentUser || (currentUser && movie.limitReached && !movie.hasVoted) || movie.hasVoted;
        
        let finalButtonText = buttonText;
        if (!currentUser) {
            finalButtonText = "Debes Iniciar Sesión";
        } else if (movie.limitReached && !movie.hasVoted) {
            finalButtonText = "Límite Alcanzado (6/6)";
        } else if (movie.hasVoted) {
            finalButtonText = "Votado";
        }

        // 💡 ESTRUCTURA MULTIMEDIA EN LA TARJETA PRINCIPAL
        card.innerHTML = `
            <img src="${movie.posterUrl}" alt="${movie.title}" class="movie-poster">
            <div class="movie-info">
                <h3>${movie.title}</h3>
                <p class="short-desc">${movie.description.substring(0, 80)}...</p>
                <div class="trailer-wrap">
                    <iframe width="100%" height="200"
                        src="${movie.trailerUrl}?enablejsapi=1&rel=0"
                        frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen class="movie-trailer" id="trailer-${movie.id}"></iframe>
                </div>
                <p><strong>Votos Totales:</strong> <span id="votes-${movie.id}">${movie.votes}</span></p>
                <div class="btn-row">
                    <button class="vote-btn" id="btn-${movie.id}" ${buttonDisabled ? 'disabled' : ''}>${finalButtonText}</button>
                    <button class="details-btn" data-id="${movie.id}">Detalles</button> 
                </div>
            </div>
        `;
        moviesContainer.appendChild(card);
    });

    document.querySelectorAll(".vote-btn").forEach(btn => {
        const movieId = Number(btn.id.split('-')[1]);
        btn.addEventListener("click", () => voteForMovie(movieId));
    });

    // 💡 EVENTO DE DETALLES: Clic en el póster o el botón "Detalles"
    document.querySelectorAll(".movie-poster, .details-btn").forEach((el) => {
        const card = el.closest(".movie-card");
        const movieId = Number(card.dataset.id);
        el.addEventListener("click", () => showMovieDetailsById(movieId));
    });

    initYouTubePlayers(); 
}

// Actualiza el estado de los botones
async function updateVoteButtonsState() {
    if (!currentUser) return;
    
    const userDocRef = doc(db, USER_VOTES_COLLECTION, currentUser.uid);
    const userDoc = await getDoc(userDocRef);
    const votedMovieIds = userDoc.exists() ? userDoc.data().voted_movies || [] : [];
    
    const limitReached = votedMovieIds.length >= 6;
    
    document.querySelectorAll(".vote-btn").forEach(btn => {
        const movieId = Number(btn.id.split('-')[1]);
        const alreadyVoted = votedMovieIds.includes(movieId);
        
        btn.disabled = limitReached || alreadyVoted;
        
        if (limitReached && !alreadyVoted) {
            btn.textContent = "Límite Alcanzado (6/6)";
        } else if (alreadyVoted) {
            btn.textContent = "Votado";
        } else {
            btn.textContent = "Votar";
        }
    });
}


// 💡 FUNCIÓN DE VOTACIÓN (ALTA CONCURRENCIA)
async function voteForMovie(id) {
    if (!currentUser) {
        alert("🚨 Debes iniciar sesión con tu cuenta UDABOL para votar.");
        return;
    }

    const movie = allMoviesData.find(m => m.id === id);
    if (!movie) return;

    try {
        const userDocRef = doc(db, USER_VOTES_COLLECTION, currentUser.uid);
        
        // 1. Verificar límite
        const userDoc = await getDoc(userDocRef);
        const votedMovies = userDoc.exists() ? userDoc.data().voted_movies || [] : [];
        
        if (votedMovies.includes(id)) {
            alert("Ya votaste por esta película.");
            return;
        }

        if (votedMovies.length >= 6) {
            alert("🛑 ¡Límite alcanzado! Solo puedes votar por 6 películas en total.");
            updateVoteButtonsState();
            return;
        }

        // 2. REGISTRO DE VOTO ESCALABLE (Sharding + Incremento Atómico)
        const randomShardRef = getRandomShardRef(id);

        await setDoc(randomShardRef, {
            count: increment(1) 
        }, { merge: true }); 

        
        // 3. Registrar el voto en el documento del usuario
        await setDoc(userDocRef, {
            voted_movies: arrayUnion(id)
        }, { merge: true });

        // 4. Animación
        const btn = document.getElementById(`btn-${id}`);
        if (btn) {
            const card = btn.closest(".movie-card");
            card.style.transform = "scale(1.06)";
            setTimeout(()=> card.style.transform = "", 260);
        }

        updateVoteButtonsState(); 
        setupRealtimeListener(); 

    } catch(error) {
        console.error("🔥 ERROR CRÍTICO DE VOTACIÓN EN FIRESTORE:", error.code, error.message);
        alert("Hubo un error al registrar tu voto. Inténtalo de nuevo.");
    }
}


// 💡 FUNCIÓN DE ESCUCHA DE TIEMPO REAL MODIFICADA PARA SHARDING
async function setupRealtimeListener() {
    const q = query(moviesCollection, orderBy("id", "asc"));

    onSnapshot(q, async (snapshot) => {
        let votedMovieIds = [];
        let limitReached = false;
        
        if (currentUser) {
            const userDocRef = doc(db, USER_VOTES_COLLECTION, currentUser.uid);
            const userDoc = await getDoc(userDocRef);
            votedMovieIds = userDoc.exists() ? userDoc.data().voted_movies || [] : [];
            limitReached = votedMovieIds.length >= 6; 
        }

        let combinedMovies = [];
        
        const promises = snapshot.docs.map(async (movieDoc) => {
            const firestoreData = movieDoc.data();
            const movieId = firestoreData.id;
            const metadata = MOVIES_METADATA.find(m => m.id === movieId);
            
            if (metadata) {
                const shardsSnapshot = await getDocs(collection(db, "movies", movieDoc.id, "shards"));
                let totalVotes = 0;
                
                if (!shardsSnapshot.empty) {
                    shardsSnapshot.forEach(shardDoc => {
                        totalVotes += shardDoc.data().count || 0;
                    });
                }
                
                combinedMovies.push({
                    ...metadata,
                    ...firestoreData,
                    docId: movieDoc.id,
                    votes: totalVotes, // SUMA DE LOS SHARDS
                    hasVoted: votedMovieIds.includes(movieId),
                    limitReached: limitReached
                });
            }
        });

        try {
            await Promise.all(promises);
        } catch(e) {
            console.error("Fallo al procesar fragmentos (Shards):", e);
        }
        
        combinedMovies.sort((a,b) => b.votes - a.votes || a.id - b.id);
        allMoviesData = combinedMovies;
        
        if (allMoviesData.length === 0 && MOVIES_METADATA.length > 0) {
            allMoviesData = MOVIES_METADATA.map(m => ({ ...m, votes: 0, hasVoted: false, limitReached: false, docId: String(m.id) }));
        }

        renderMovies(); 
        
    }, (error) => {
        console.error("🔥 Error de CONEXIÓN/ÍNDICE en Firestore:", error);
        
        if (MOVIES_METADATA.length > 0) {
            allMoviesData = MOVIES_METADATA.map(m => ({ ...m, votes: 0, hasVoted: false, limitReached: false, docId: String(m.id) }));
            renderMovies();
        }
    });
}


// 💡 FUNCIÓN MODAL: AHORA SOLO MUESTRA TEXTO (Sin videos, sin fotos de actores)
function showMovieDetails(movie) {
    // 1. Título
    document.getElementById("details-title").textContent = movie.title;
    
    // 2. Contenedor principal de texto
    const textContainer = document.getElementById("details-text-container");
    textContainer.innerHTML = ''; // Limpia el contenedor

    // 3. Resumen y Ficha Técnica
    textContainer.innerHTML += `
        <h3>Sinopsis Completa</h3>
        <p>${movie.sinopsis_larga || movie.description}</p>
    `;

    textContainer.innerHTML += `
        <h3>Ficha Técnica</h3>
        <p><strong>Director:</strong> ${movie.director || 'N/A'}</p>
        <p><strong>Duración:</strong> ${movie.duracion || 'N/A'}</p>
        <p><strong>Clasificación:</strong> ${movie.clasificacion || 'N/A'}</p>
    `;
    
    // 4. Reparto (Lista de actores separada por comas)
    const actorNames = movie.cast.map(a => a.name).join(', ');
    
    textContainer.innerHTML += `
        <h3>Actores Principales</h3>
        <p>${actorNames || 'Información no disponible.'}</p>
    `;

    // 5. Muestra el modal
    const modal = document.getElementById("movie-details");
    if (modal) modal.style.display = "block";
    
    // 💡 Detener todos los players al abrir el modal (Buenas prácticas)
    for (const playerId in players) {
        try { players[playerId].pauseVideo(); } catch(e) {}
    }
}


// ----------------------------------------------------
// FUNCIONES AUXILIARES RESTAURADAS
// ----------------------------------------------------

function initYouTubePlayers() {
    document.querySelectorAll(".movie-trailer").forEach((iframe) => {
      const id = iframe.id; 
      if (!players[id]) {
        players[id] = new YT.Player(id, {
          events: {
            onReady: (event) => { /* listo */ }
          }
        });
        iframe.addEventListener("mouseenter", () => {
          const p = players[id];
          try { p.playVideo(); } catch(e){ /* ignore */ }
        });
        iframe.addEventListener("mouseleave", () => {
          const p = players[id];
          try { p.pauseVideo(); } catch(e){ /* ignore */ }
        });
      }
    });
}

function onYouTubeIframeAPIReady() {
    initYouTubePlayers();
}

if (window.YT && window.YT.Player) {
    setTimeout(initYouTubePlayers, 500);
}

function showMovieDetailsById(movieId) {
    const movie = allMoviesData.find(m => m.id === movieId);
    if (!movie) return;
    showMovieDetails(movie);
}

const closeModalBtn = document.getElementById("close-modal");
if (closeModalBtn) {
  closeModalBtn.addEventListener("click", () => {
    const modal = document.getElementById("movie-details");
    if (modal) modal.style.display = "none";
  });
}

window.addEventListener("click", (e) => {
    const modal = document.getElementById("movie-details");
    if (!modal) return;
    if (e.target === modal) modal.style.display = "none";
});

function startCountdown() {
    const eventDate = new Date("2025/10/30 09:00:00");
    const timerEl = document.getElementById("timer");
    if (!timerEl) return;

    function update() {
        const now = new Date();
        const diff = eventDate - now;

        if (isNaN(diff) || diff <= 0) {
            timerEl.innerHTML = "🎉 ¡El evento ha comenzado! 🎥";
            return;
        }

        const totalSeconds = Math.floor(diff / 1000);
        const days = Math.floor(totalSeconds / (60*60*24));
        const hours = Math.floor((totalSeconds / (60*60)) % 24);
        const minutes = Math.floor((totalSeconds / 60) % 60);
        const seconds = Math.floor(totalSeconds % 60);

        const daysEl = document.getElementById("days");
        const hoursEl = document.getElementById("hours");
        const minutesEl = document.getElementById("minutes");
        const secondsEl = document.getElementById("seconds");

        if (daysEl && hoursEl && minutesEl && secondsEl) {
            daysEl.textContent = days.toString().padStart(2,'0');
            hoursEl.textContent = hours.toString().padStart(2,'0');
            minutesEl.textContent = minutes.toString().padStart(2,'0');
            secondsEl.textContent = seconds.toString().padStart(2,'0');
        } else {
            timerEl.textContent = `${days.toString().padStart(2,'0')}d : ${hours.toString().padStart(2,'0')}h : ${minutes.toString().padStart(2,'0')}m : ${seconds.toString().padStart(2,'0')}s`;
        }
    }

    update();
    setInterval(update, 1000);
}

// ---------- Inicialización ----------
window.addEventListener("load", () => {
    setupRealtimeListener(); 
    startCountdown();
});