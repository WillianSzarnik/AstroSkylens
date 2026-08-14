import { CelestialObject, ConstellationData, MoonPhaseInfo, ObserverCoords } from '../types/astronomy';

// Constants
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * Calculates Julian Day Number from Date
 */
export function getJulianDate(date: Date = new Date()): number {
  const time = date.getTime();
  return time / 86400000 + 2440587.5;
}

/**
 * Calculates Greenwich Mean Sidereal Time (GMST) in hours
 */
export function getGMST(date: Date = new Date()): number {
  const jd = getJulianDate(date);
  const d = jd - 2451545.0; // Days since J2000.0
  let gmst = 18.697374558 + 24.06570982441908 * d;
  gmst = ((gmst % 24) + 24) % 24;
  return gmst;
}

/**
 * Calculates Local Sidereal Time (LST) in hours
 */
export function getLST(date: Date, longitudeDeg: number): number {
  const gmst = getGMST(date);
  let lst = gmst + longitudeDeg / 15.0;
  lst = ((lst % 24) + 24) % 24;
  return lst;
}

/**
 * Converts Equatorial Coordinates (RA in hours, Dec in degrees)
 * to Horizontal Coordinates (Altitude and Azimuth in degrees)
 */
export function equatorialToHorizontal(
  raHours: number,
  decDeg: number,
  latDeg: number,
  lonDeg: number,
  date: Date = new Date()
): { altitude: number; azimuth: number } {
  const lstHours = getLST(date, lonDeg);
  let haHours = lstHours - raHours;
  haHours = ((haHours % 24) + 24) % 24;
  const haRad = haHours * 15 * DEG2RAD;

  const latRad = latDeg * DEG2RAD;
  const decRad = decDeg * DEG2RAD;

  // Altitude
  const sinAlt =
    Math.sin(decRad) * Math.sin(latRad) +
    Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
  const altRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const altitude = altRad * RAD2DEG;

  // Azimuth
  const cosAz =
    (Math.sin(decRad) - Math.sin(latRad) * Math.sin(altRad)) /
    (Math.cos(latRad) * Math.cos(altRad));
  const sinAz = (-Math.cos(decRad) * Math.sin(haRad)) / Math.cos(altRad);

  let azRad = Math.atan2(sinAz, cosAz);
  let azimuth = azRad * RAD2DEG;
  azimuth = ((azimuth % 360) + 360) % 360;

  return { altitude, azimuth };
}

/**
 * Calculates Solar and Planetary Coordinates
 */
export function calculateSolarSystem(
  date: Date,
  lat: number,
  lon: number
): CelestialObject[] {
  const jd = getJulianDate(date);
  const d = jd - 2451545.0; // Days from epoch J2000.0

  // 1. Sun
  const sunMeanLon = (280.46 + 0.9856474 * d) % 360;
  const sunMeanAnomaly = (357.528 + 0.9856003 * d) * DEG2RAD;
  const sunEclipticLon =
    (sunMeanLon +
      1.915 * Math.sin(sunMeanAnomaly) +
      0.02 * Math.sin(2 * sunMeanAnomaly)) *
    DEG2RAD;
  const obliquity = 23.439 * DEG2RAD;

  const sunRaRad = Math.atan2(
    Math.cos(obliquity) * Math.sin(sunEclipticLon),
    Math.cos(sunEclipticLon)
  );
  const sunDecRad = Math.asin(Math.sin(obliquity) * Math.sin(sunEclipticLon));
  let sunRaHours = ((sunRaRad * RAD2DEG) / 15 + 24) % 24;
  let sunDecDeg = sunDecRad * RAD2DEG;

  const sunCoords = equatorialToHorizontal(sunRaHours, sunDecDeg, lat, lon, date);

  // 2. Moon
  const moonMeanLon = (218.316 + 13.176396 * d) % 360;
  const moonMeanAnomaly = (134.963 + 13.064993 * d) * DEG2RAD;
  const moonEclipticLon =
    (moonMeanLon + 6.289 * Math.sin(moonMeanAnomaly)) * DEG2RAD;
  const moonEclipticLat = (5.128 * Math.sin((93.272 + 13.22935 * d) * DEG2RAD)) * DEG2RAD;

  const moonRaRad = Math.atan2(
    Math.sin(moonEclipticLon) * Math.cos(obliquity) -
      Math.tan(moonEclipticLat) * Math.sin(obliquity),
    Math.cos(moonEclipticLon)
  );
  const moonDecRad = Math.asin(
    Math.sin(moonEclipticLat) * Math.cos(obliquity) +
      Math.cos(moonEclipticLat) * Math.sin(obliquity) * Math.sin(moonEclipticLon)
  );
  let moonRaHours = ((moonRaRad * RAD2DEG) / 15 + 24) % 24;
  let moonDecDeg = moonDecRad * RAD2DEG;
  const moonCoords = equatorialToHorizontal(moonRaHours, moonDecDeg, lat, lon, date);

  // Major Planets Approximate Ephemeris
  const planetsData = [
    {
      id: 'mercury',
      name: 'Mercúrio',
      scientificName: 'Mercurius',
      type: 'planet' as const,
      period: 87.97,
      baseRa: 4.2,
      baseDec: 18.5,
      mag: -0.4,
      distance: '0.98 UA (~147 mi km)',
      constellation: 'Touro / Gêmeos',
      color: '#e2e8f0',
      description: 'O menor planeta do Sistema Solar e o mais próximo do Sol.',
      facts: [
        'Sua temperatura varia de -180°C à noite até 430°C de dia.',
        'Não possui atmosfera densa, apenas uma fina exosfera de oxigênio e sódio.',
        'A sonda MESSENGER da NASA descobriu gelo de água em suas crateras polares permanentemente sombreadas.',
      ],
      tips: 'Melhor visível logo após o pôr do sol ou antes do amanhecer próximo ao horizonte.',
    },
    {
      id: 'venus',
      name: 'Vênus (Estrela D\'Alva)',
      scientificName: 'Venus (Phosphorus / Hesperus)',
      type: 'planet' as const,
      period: 224.7,
      baseRa: 6.8,
      baseDec: 24.2,
      mag: -4.4,
      distance: '0.72 UA (~108 mi km)',
      constellation: 'Gêmeos / Câncer',
      color: '#fef08a',
      description: 'O objeto natural mais brilhante no céu noturno depois da Lua.',
      facts: [
        'Sua densa atmosfera de dióxido de carbono causa um efeito estufa descontrolado com 465°C constantes.',
        'Gira em rotação retrógrada (de leste para oeste), ao contrário da maioria dos planetas.',
        'Suas nuvens são formadas por ácido sulfúrico altamente reflexivo.',
      ],
      tips: 'Resplandece como um farol luminoso no crepúsculo. Um pequeno telescópio revela suas fases semelhantes às da Lua.',
    },
    {
      id: 'mars',
      name: 'Marte (Planeta Vermelho)',
      scientificName: 'Mars',
      type: 'planet' as const,
      period: 686.98,
      baseRa: 10.5,
      baseDec: 12.1,
      mag: -0.5,
      distance: '1.42 UA (~212 mi km)',
      constellation: 'Leão',
      color: '#f87171',
      description: 'O Planeta Vermelho, lar do maior vulcão do Sistema Solar, o Monte Olimpo.',
      facts: [
        'Sua coloração avermelhada se deve ao óxido de ferro (ferrugem) abundante no solo.',
        'Possui duas pequenas luas com formato irregular: Fobos e Deimos.',
        'Os rovers Perseverance e Curiosity da NASA estão ativamente buscando bioassinaturas fósseis no solo marciano.',
      ],
      tips: 'Facilmente identificado pelo brilho alaranjado constante, sem a cintilação típica das estrelas.',
    },
    {
      id: 'jupiter',
      name: 'Júpiter',
      scientificName: 'Jupiter',
      type: 'planet' as const,
      period: 4332.59,
      baseRa: 3.4,
      baseDec: 17.2,
      mag: -2.6,
      distance: '4.85 UA (~725 mi km)',
      constellation: 'Touro',
      color: '#fed7aa',
      description: 'O rei dos planetas, um gigante gasoso com mais massa que todos os outros planetas juntos.',
      facts: [
        'A Grande Mancha Vermelha é uma tempestade anticiclônica maior que a Terra em atividade há séculos.',
        'Possui mais de 95 luas conhecidas, incluindo as 4 galileanas: Ío, Europa, Ganimedes e Calisto.',
        'A missão Juno da NASA orbita seus polos revelando ciclones cósmicos colossais.',
      ],
      tips: 'Mesmo um binóculo 10x50 revela as quatro luas galileanas alinhadas ao lado do disco planetário.',
    },
    {
      id: 'saturn',
      name: 'Saturno',
      scientificName: 'Saturnus',
      type: 'planet' as const,
      period: 10759.22,
      baseRa: 23.2,
      baseDec: -6.4,
      mag: 0.6,
      distance: '9.42 UA (~1.4 bi km)',
      constellation: 'Aquário',
      color: '#fef3c7',
      description: 'A joia do Sistema Solar, famoso pelo seu espetacular sistema de anéis de gelo e rocha.',
      facts: [
        'Os anéis principais têm espessura média de apenas 10 a 30 metros, mas se estendem por 282.000 km.',
        'Sua lua Titã possui lagos de metano líquido e uma densa atmosfera de nitrogênio.',
        'Sua densidade média é menor que a da água; se houvesse um oceano grande o bastante, Saturno flutuaria!',
      ],
      tips: 'Um telescópio de 60mm a 70mm já revela com clareza a divisão de Cassini em seus anéis majestosos.',
    },
    {
      id: 'uranus',
      name: 'Urano',
      scientificName: 'Uranus',
      type: 'planet' as const,
      period: 30685.4,
      baseRa: 3.8,
      baseDec: 19.8,
      mag: 5.7,
      distance: '19.2 UA (~2.8 bi km)',
      constellation: 'Touro',
      color: '#67e8f9',
      description: 'Um gigante de gelo com eixo de rotação quase totalmente inclinado (98°).',
      facts: [
        'Gira "de lado", o que provoca estações climáticas extremas que duram mais de 20 anos terrestres.',
        'Sua atmosfera contém metano, que absorve luz vermelha e confere a bela cor azul-turquesa.',
        'Possui 28 luas conhecidas, todas nomeadas em homenagem a personagens de William Shakespeare e Alexander Pope.',
      ],
      tips: 'Visível no limite da visão humana em céus muito escuros, ou facilmente com binóculos como uma pontinha azul-esverdeada.',
    },
    {
      id: 'neptune',
      name: 'Netuno',
      scientificName: 'Neptunus',
      type: 'planet' as const,
      period: 60189.0,
      baseRa: 23.9,
      baseDec: -2.1,
      mag: 7.8,
      distance: '29.8 UA (~4.45 bi km)',
      constellation: 'Peixes',
      color: '#60a5fa',
      description: 'O planeta mais distante do Sol, lar dos ventos mais rápidos do Sistema Solar (2.100 km/h).',
      facts: [
        'Foi o primeiro planeta descoberto por cálculos matemáticos antes de ser observado por telescópio em 1846.',
        'Sua maior lua, Tritão, possui gêiseres de nitrogênio líquido e órbita retrógrada.',
        'A temperatura média em sua atmosfera superior chega a -214°C.',
      ],
      tips: 'Requer binóculo ou telescópio para ser distinguido das estrelas de fundo.',
    },
  ];

  const planets: CelestialObject[] = planetsData.map((p) => {
    // Slight drift over time based on orbital speed
    const driftRa = (d / p.period) * 24;
    const ra = ((p.baseRa + driftRa) % 24 + 24) % 24;
    const dec = p.baseDec + 2 * Math.sin((d / p.period) * 2 * Math.PI);
    const coords = equatorialToHorizontal(ra, dec, lat, lon, date);

    return {
      ...p,
      ra,
      dec,
      altitude: coords.altitude,
      azimuth: coords.azimuth,
      isVisible: coords.altitude > 0,
    };
  });

  // Sun object
  const sunObj: CelestialObject = {
    id: 'sun',
    name: 'Sol',
    scientificName: 'Sol (Estrela G2V)',
    type: 'sun',
    ra: sunRaHours,
    dec: sunDecDeg,
    mag: -26.74,
    distance: '1.00 UA (~149.6 mi km)',
    constellation: 'Eclíptica',
    spectralType: 'G2V',
    color: '#fbbf24',
    description: 'Nossa estrela-mãe, fonte de energia, luz e gravidade que sustenta a vida no Sistema Solar.',
    facts: [
      'Concentra 99.86% de toda a massa do Sistema Solar.',
      'Em seu núcleo a 15 milhões de graus Celsius, funde 600 milhões de toneladas de hidrogênio em hélio a cada segundo.',
      'A sonda Parker Solar Probe da NASA voa através da coroa solar a velocidades superiores a 600.000 km/h.',
    ],
    tips: 'NUNCA olhe diretamente para o Sol com binóculos ou telescópios sem filtros solares certificados!',
    altitude: sunCoords.altitude,
    azimuth: sunCoords.azimuth,
    isVisible: sunCoords.altitude > 0,
  };

  // Moon object
  const moonObj: CelestialObject = {
    id: 'moon',
    name: 'Lua',
    scientificName: 'Luna',
    type: 'moon',
    ra: moonRaHours,
    dec: moonDecDeg,
    mag: -12.74,
    distance: '384.400 km (~1.28 seg-luz)',
    constellation: 'Céu Noturno',
    color: '#f1f5f9',
    description: 'O único satélite natural da Terra, responsável pelas marés e estabilização da rotação do nosso planeta.',
    facts: [
      'Está em rotação sincronizada, mostrando sempre a mesma face para a Terra.',
      'A missão Artemis da NASA planeja o retorno de astronautas à superfície lunar para estabelecer base sustentável.',
      'Suas crateras de impacto preservam 4 bilhões de anos da história cósmica primordial.',
    ],
    tips: 'A linha do terminador (fronteira entre luz e sombra) é o melhor local para observar sombras de montanhas e crateras.',
    altitude: moonCoords.altitude,
    azimuth: moonCoords.azimuth,
    isVisible: moonCoords.altitude > 0,
  };

  return [sunObj, moonObj, ...planets];
}

/**
 * Calculates accurate Moon Phase
 */
export function getMoonPhase(date: Date = new Date()): MoonPhaseInfo {
  const jd = getJulianDate(date);
  // Known new moon reference: Jan 6, 2000 18:14 UTC (JD 2451549.26)
  const synodicMonth = 29.53058867;
  const daysSinceNew = (jd - 2451549.26) % synodicMonth;
  const ageDays = (daysSinceNew + synodicMonth) % synodicMonth;
  const phaseFraction = ageDays / synodicMonth;
  const phaseAngle = phaseFraction * 2 * Math.PI;

  // Illumination percentage (0 to 1)
  const illumination = (1 - Math.cos(phaseAngle)) / 2;

  let phaseName = 'Lua Nova';
  let icon = '🌑';

  if (ageDays < 1.84) {
    phaseName = 'Lua Nova';
    icon = '🌑';
  } else if (ageDays < 5.53) {
    phaseName = 'Crescente Côncava';
    icon = '🌒';
  } else if (ageDays < 9.22) {
    phaseName = 'Quarto Crescente';
    icon = '🌓';
  } else if (ageDays < 12.91) {
    phaseName = 'Crescente Gibosa';
    icon = '🌔';
  } else if (ageDays < 16.61) {
    phaseName = 'Lua Cheia';
    icon = '🌕';
  } else if (ageDays < 20.3) {
    phaseName = 'Minguante Gibosa';
    icon = '🌖';
  } else if (ageDays < 23.99) {
    phaseName = 'Quarto Minguante';
    icon = '🌗';
  } else if (ageDays < 27.68) {
    phaseName = 'Minguante Côncava';
    icon = '🌘';
  } else {
    phaseName = 'Lua Nova';
    icon = '🌑';
  }

  const nextFullMoonDays = (14.765 - ageDays + synodicMonth) % synodicMonth;
  const nextNewMoonDays = (synodicMonth - ageDays) % synodicMonth;

  return {
    phaseName,
    illumination,
    ageDays: Math.round(ageDays * 10) / 10,
    phaseAngle,
    nextFullMoonDays: Math.round(nextFullMoonDays),
    nextNewMoonDays: Math.round(nextNewMoonDays),
    icon,
  };
}

/**
 * Catalog of Bright Stars
 */
export const BRIGHT_STARS_CATALOG: Omit<CelestialObject, 'altitude' | 'azimuth' | 'isVisible'>[] = [
  {
    id: 'sirius',
    name: 'Sírius',
    scientificName: 'Alpha Canis Majoris (HIP 32349)',
    type: 'star',
    ra: 6.752,
    dec: -16.716,
    mag: -1.46,
    distance: '8.6 anos-luz',
    constellation: 'Cão Maior (Canis Major)',
    spectralType: 'A1V (Branca)',
    color: '#a5f3fc',
    description: 'A estrela mais brilhante de todo o céu noturno, com um brilho azul-esbranquiçado hipnotizante.',
    mythology: 'No antigo Egito, seu nascimento helíaco anunciava as inundações anuais do Rio Nilo e o ano novo.',
    facts: [
      'É um sistema binário composto por Sirius A e uma anã branca densa chamada Sirius B (apelidada de "O Filhote").',
      'Brilha 25 vezes mais que o nosso Sol e está muito próxima cosmicamente da Terra.',
      'Sua cintilação intensa de várias cores no horizonte se deve à refração na atmosfera terrestre.',
    ],
    tips: 'Facilmente localizada prolongando a linha das Três Marias (Cinturão de Órion) para o sudeste.',
  },
  {
    id: 'canopus',
    name: 'Canopus',
    scientificName: 'Alpha Carinae (HIP 30438)',
    type: 'star',
    ra: 6.399,
    dec: -52.695,
    mag: -0.74,
    distance: '310 anos-luz',
    constellation: 'Carina (Quilha)',
    spectralType: 'A9II (Supergigante Branco-amarelada)',
    color: '#fef08a',
    description: 'A segunda estrela mais brilhante do céu, um farol de navegação cósmica para sondas espaciais.',
    mythology: 'Nomeada em honra a Canopo, o piloto da frota do rei Menelau na mitologia da Guerra de Troia.',
    facts: [
      'É uma supergigante luminosa 10.000 vezes mais brilhante que o Sol.',
      'Sondas espaciais da NASA (como as Voyager e New Horizons) usam Canopus como ponto de referência para orientação giroscópica.',
      'Visível primordialmente no hemisfério sul e latitudes equatoriais.',
    ],
    tips: 'Localizada ao sul de Sírius, brilha de forma majestosa durante quase todo o ano no Brasil.',
  },
  {
    id: 'rigil_kentaurus',
    name: 'Alpha Centauri (Rigil Kentaurus)',
    scientificName: 'Alpha Centauri A & B (HIP 71683)',
    type: 'star',
    ra: 14.66,
    dec: -60.833,
    mag: -0.27,
    distance: '4.37 anos-luz',
    constellation: 'Centauro (Centaurus)',
    spectralType: 'G2V + K1V (Sistema Triplo)',
    color: '#fde047',
    description: 'O sistema estelar mais próximo do nosso Sistema Solar.',
    mythology: 'Representa um dos pés do nobre Centauro Quirón na mitologia grega.',
    facts: [
      'Composto por três estrelas: Alpha Centauri A (semelhante ao Sol), Alpha Centauri B e a anã vermelha Proxima Centauri.',
      'Proxima Centauri abriga o exoplaneta Proxima b, orbitando na zona habitável.',
      'Serve como um dos "Ponteiros do Cruzeiro do Sul" ao lado de Hadar.',
    ],
    tips: 'Aponte binóculos para separar visualmente as duas estrelas brilhantes A e B.',
  },
  {
    id: 'arcturus',
    name: 'Arcturus',
    scientificName: 'Alpha Boötis (HIP 69673)',
    type: 'star',
    ra: 14.261,
    dec: 19.182,
    mag: -0.05,
    distance: '36.7 anos-luz',
    constellation: 'Pastor (Boötes)',
    spectralType: 'K1.5III (Gigante Laranja)',
    color: '#fdba74',
    description: 'A estrela mais brilhante do hemisfério celeste norte, com uma rica cor alaranjada.',
    mythology: 'Seu nome vem do grego Arktouros ("O Guardião do Urso"), seguindo a Ursa Maior pelo céu.',
    facts: [
      'É uma estrela gigante velha que já fundiu a maior parte do hidrogênio em seu núcleo.',
      'Tem 25 vezes o diâmetro do nosso Sol e desloca-se a grande velocidade relativa através da Via Láctea.',
      'Sua luz de 1933 foi usada para acionar fotoeletricamente a abertura da Feira Mundial de Chicago.',
    ],
    tips: 'Siga a curva da cauda da Ursa Maior ("Siga o arco até Arcturus").',
  },
  {
    id: 'vega',
    name: 'Vega',
    scientificName: 'Alpha Lyrae (HIP 91262)',
    type: 'star',
    ra: 18.615,
    dec: 38.783,
    mag: 0.03,
    distance: '25 anos-luz',
    constellation: 'Lira (Lyra)',
    spectralType: 'A0V (Azul-branca)',
    color: '#bae6fd',
    description: 'O padrão zero da escala de magnitudes estelares e vértice do Triângulo de Verão.',
    mythology: 'Representa a lira encantada de Orfeu, cuja música amansava feras e deuses.',
    facts: [
      'Foi a primeira estrela além do Sol a ser fotografada (em 1850 no Harvard College Observatory).',
      'Foi a Estrela Polar da Terra há 14.000 anos e voltará a ser por volta do ano 13.727 devido à precessão dos equinócios.',
      'Possui um anel de poeira circunstelar onde podem estar se formando planetas.',
    ],
    tips: 'Estrela brilhante de tom azulado puro de fácil visualização em noites de inverno/primavera.',
  },
  {
    id: 'capella',
    name: 'Capella',
    scientificName: 'Alpha Aurigae (HIP 24608)',
    type: 'star',
    ra: 5.278,
    dec: 45.998,
    mag: 0.08,
    distance: '42.9 anos-luz',
    constellation: 'Cocheiro (Auriga)',
    spectralType: 'G3III (Gigante Quádrupla Amarela)',
    color: '#fef08a',
    description: 'Um impressionante sistema estelar quádruplo que brilha com tonalidade dourada.',
    mythology: 'Representa a cabra Amalteia, que amamentou o jovem deus Zeus na caverna do Monte Ida.',
    facts: [
      'Consiste em dois pares de estrelas binárias orbitando umas às outras.',
      'É rica em emissão de raios X por conta da rápida rotação de suas estrelas gigantes.',
    ],
    tips: 'Brilha intensamente em direção ao horizonte norte nos meses de verão no Brasil.',
  },
  {
    id: 'rigel',
    name: 'Rigel',
    scientificName: 'Beta Orionis (HIP 24436)',
    type: 'star',
    ra: 5.242,
    dec: -8.201,
    mag: 0.13,
    distance: '860 anos-luz',
    constellation: 'Órion',
    spectralType: 'B8Ia (Supergigante Azul)',
    color: '#93c5fd',
    description: 'A supergigante azul que forma o pé esquerdo do caçador celestial Órion.',
    mythology: 'Representa o pé do caçador gigante Órion na mitologia clássica greco-romana.',
    facts: [
      'Brilha com o poder de cerca de 120.000 Sóis!',
      'Sua temperatura superficial ultrapassa os 12.000 Kelvin.',
      'No futuro se tornará uma supernova devastadora visível até em plena luz do dia.',
    ],
    tips: 'Forma a diagonal clássica de Órion oposta à avermelhada Betelgeuse.',
  },
  {
    id: 'procyon',
    name: 'Procyon',
    scientificName: 'Alpha Canis Minoris (HIP 37279)',
    type: 'star',
    ra: 7.655,
    dec: 5.225,
    mag: 0.38,
    distance: '11.5 anos-luz',
    constellation: 'Cão Menor (Canis Minor)',
    spectralType: 'F5IV-V (Branco-amarelada)',
    color: '#fef9c3',
    description: 'Um dos vértices do famoso Triângulo de Inverno junto com Sírius e Betelgeuse.',
    mythology: 'Seu nome significa "Antes do Cão", pois nasce no horizonte pouco antes de Sírius.',
    facts: [
      'É uma das estrelas mais próximas da Terra, possuindo uma anã branca companheira (Procyon B).',
      'Está terminando de consumir seu hidrogênio nuclear e iniciando sua transição para subgigante.',
    ],
    tips: 'Localizada a leste de Órion e ao norte de Sírius.',
  },
  {
    id: 'betelgeuse',
    name: 'Betelgeuse',
    scientificName: 'Alpha Orionis (HIP 27989)',
    type: 'star',
    ra: 5.919,
    dec: 7.407,
    mag: 0.5,
    distance: '640 anos-luz',
    constellation: 'Órion',
    spectralType: 'M1-2Ia-ab (Supergigante Vermelha)',
    color: '#f87171',
    description: 'Uma monumental supergigante vermelha prestes a explodir em supernova a qualquer momento cósmico.',
    mythology: 'Representa o ombro direito do caçador celestial Órion.',
    facts: [
      'É tão colossal que, se estivesse no centro do nosso Sistema Solar, engoliria Mercúrio, Vênus, Terra e Marte!',
      'Em 2019-2020 passou pelo "Grande Escurecimento" após ejetar uma gigantesca nuvem de poeira cósmica.',
      'Quando explodir em supernova, brilhará tão forte quanto a Lua Cheia por semanas.',
    ],
    tips: 'Observe a nítida cor vermelho-alaranjada contrastando com a azulada Rigel.',
  },
  {
    id: 'achernar',
    name: 'Achernar',
    scientificName: 'Alpha Eridani (HIP 7588)',
    type: 'star',
    ra: 1.628,
    dec: -57.236,
    mag: 0.46,
    distance: '139 anos-luz',
    constellation: 'Erídano (Eridanus)',
    spectralType: 'B6Vep (Azul)',
    color: '#7dd3fc',
    description: 'A estrela menos esférica conhecida no céu, achatada pela sua rotação vertiginosa.',
    mythology: 'Seu nome em árabe significa "O Fim do Rio", demarcando a foz do rio mítico Erídano.',
    facts: [
      'Gira tão rápido (250 km/s no equador) que seu diâmetro equatorial é 56% maior que o polar!',
      'Quase atinge a velocidade de ruptura crítica em que a gravidade não conteria sua matéria.',
    ],
    tips: 'Estrela muito brilhante e isolada ao sul, excelente para alinhamento em latitudes austrais.',
  },
  {
    id: 'hadar',
    name: 'Hadar (Beta Centauri)',
    scientificName: 'Beta Centauri (HIP 68702)',
    type: 'star',
    ra: 14.064,
    dec: -60.373,
    mag: 0.61,
    distance: '390 anos-luz',
    constellation: 'Centauro (Centaurus)',
    spectralType: 'B1III (Azul-branca)',
    color: '#93c5fd',
    description: 'O segundo ponteiro do Cruzeiro do Sul, uma estrela tripla extremamente energética.',
    mythology: 'Seu nome árabe Hadar significa "Solo" ou "Presença".',
    facts: [
      'Forma um par inconfundível com Alpha Centauri apontando direto para o Cruzeiro do Sul.',
      'Suas estrelas componentes são gigantes azuis com massas superiores a 10 vezes a massa solar.',
    ],
    tips: 'Localizada logo ao lado de Alpha Centauri.',
  },
  {
    id: 'acrux',
    name: 'Acrux (Alpha Crucis)',
    scientificName: 'Alpha Crucis (HIP 60718)',
    type: 'star',
    ra: 12.443,
    dec: -63.099,
    mag: 0.77,
    distance: '320 anos-luz',
    constellation: 'Cruzeiro do Sul (Crux)',
    spectralType: 'B0.5IV + B1V (Azul)',
    color: '#60a5fa',
    description: 'A estrela da base da cruz do Cruzeiro do Sul, símbolo nacional do Brasil e países do sul.',
    mythology: 'Para os indígenas Tupi-Guarani, o Cruzeiro do Sul faz parte da grande constelação da Ema Celestial.',
    facts: [
      'Representa o estado de São Paulo na bandeira do Brasil.',
      'É um sistema estelar múltiplo com pelo menos 5 estrelas gravitacionalmente ligadas.',
      'Usada como bússola natural: estendendo seu eixo 4.5 vezes para baixo encontra-se o Polo Sul Celeste.',
    ],
    tips: 'A estrela mais brilhante e meridional da famosa cruz.',
  },
  {
    id: 'mimosa',
    name: 'Mimosa (Beta Crucis)',
    scientificName: 'Beta Crucis (HIP 62434)',
    type: 'star',
    ra: 12.795,
    dec: -59.688,
    mag: 1.25,
    distance: '280 anos-luz',
    constellation: 'Cruzeiro do Sul (Crux)',
    spectralType: 'B0.5III (Azul-branca)',
    color: '#93c5fd',
    description: 'O braço esquerdo do Cruzeiro do Sul, pulsando como variável do tipo Beta Cephei.',
    mythology: 'Representa o estado do Rio de Janeiro na bandeira do Brasil.',
    facts: [
      'Possui ventos estelares velozes que sopram a mais de 2.000 km por segundo.',
      'Fica colada à famosa Nebulosa Saco de Carvão, uma nuvem escura de poeira cósmica.',
    ],
    tips: 'Visível ao lado da famosa nebulosa escura Saco de Carvão.',
  },
  {
    id: 'antares',
    name: 'Antares',
    scientificName: 'Alpha Scorpii (HIP 80763)',
    type: 'star',
    ra: 16.49,
    dec: -26.432,
    mag: 0.96,
    distance: '550 anos-luz',
    constellation: 'Escorpião (Scorpius)',
    spectralType: 'M1.5Iab-Ib (Supergigante Vermelha)',
    color: '#ef4444',
    description: 'O "Coração do Escorpião", uma supergigante vermelha colossal que rivaliza com o brilho de Marte.',
    mythology: 'Seu nome vem do grego Anti-Ares ("Rival de Marte"), devido à intensa cor rubra que compete com o planeta guerreiro.',
    facts: [
      'Seu raio é cerca de 700 vezes maior que o do Sol.',
      'Está envolta por uma belíssima nebulosa de reflexão amarelada rica em metais pesados.',
      'Possui uma pequena estrela companheira azulada (Antares B).',
    ],
    tips: 'Centro fulgurante da constelação do Escorpião no céu de inverno.',
  },
  {
    id: 'spica',
    name: 'Spica (Espiga)',
    scientificName: 'Alpha Virginis (HIP 65474)',
    type: 'star',
    ra: 13.419,
    dec: -11.161,
    mag: 0.98,
    distance: '250 anos-luz',
    constellation: 'Virgem (Virgo)',
    spectralType: 'B1III-IV + B2V (Binária Azul)',
    color: '#67e8f9',
    description: 'A estrela solitária da Virgem que representa a espiga de trigo da colheita.',
    mythology: 'Representa a deusa da justiça Astreia ou Deméter segurando uma espiga de trigo.',
    facts: [
      'É a estrela solitária na faixa branca central "Ordem e Progresso" da bandeira do Brasil (representando o Pará).',
      'As duas estrelas que a compõem orbitam uma à outra em apenas 4 dias, distorcidas em formato de ovais gravitacionais.',
    ],
    tips: 'Siga o arco da Ursa Maior até Arcturus e continue até Spica ("Acelere para Spica").',
  },
  {
    id: 'aldebaran',
    name: 'Aldebaran',
    scientificName: 'Alpha Tauri (HIP 21421)',
    type: 'star',
    ra: 4.598,
    dec: 16.509,
    mag: 0.85,
    distance: '65 anos-luz',
    constellation: 'Touro (Taurus)',
    spectralType: 'K5III (Gigante Vermelha)',
    color: '#f97316',
    description: 'O "Olho Furioso do Touro", marcando a constelação de Touro com tom alaranjado vivo.',
    mythology: 'Em árabe Al-Dabaran significa "O Seguidor", pois parece seguir as Plêiades através do céu.',
    facts: [
      'Tem 44 vezes o diâmetro do Sol.',
      'A sonda Pioneer 10 da NASA está atualmente viajando no espaço interestelar em direção a Aldebaran (chegará em 2 milhões de anos).',
    ],
    tips: 'Localizada no aglomerado em forma de "V" das Híades.',
  },
  {
    id: 'polaris',
    name: 'Polaris (Estrela Polar do Norte)',
    scientificName: 'Alpha Ursae Minoris (HIP 11767)',
    type: 'star',
    ra: 2.53,
    dec: 89.264,
    mag: 1.98,
    distance: '433 anos-luz',
    constellation: 'Ursa Menor (Ursa Minor)',
    spectralType: 'F7Ib (Supergigante Amarela Cefeida)',
    color: '#fef3c7',
    description: 'A bússola do norte, quase exatamente alinhada com o eixo de rotação norte da Terra.',
    mythology: 'Guia de marinheiros e exploradores do hemisfério norte por séculos.',
    facts: [
      'Todo o céu noturno do norte parece girar em torno dela.',
      'É uma estrela variável Cefeida clássica e um sistema triplo.',
    ],
    tips: 'Visível apenas em latitudes ao norte do equador.',
  },
];

/**
 * Catalog of Deep Sky Objects (Galaxies, Nebulae, Clusters, NASA Highlights)
 */
export const DEEP_SKY_CATALOG: Omit<CelestialObject, 'altitude' | 'azimuth' | 'isVisible'>[] = [
  {
    id: 'm31_andromeda',
    name: 'Galáxia de Andrômeda (M31)',
    scientificName: 'Messier 31 / NGC 224',
    type: 'galaxy',
    ra: 0.712,
    dec: 41.269,
    mag: 3.44,
    distance: '2.5 milhões de anos-luz',
    constellation: 'Andrômeda',
    color: '#c084fc',
    description: 'A galáxia espiral gigante mais próxima da Via Láctea, contendo mais de 1 trilhão de estrelas.',
    facts: [
      'É o objeto celeste mais distante visível a olho nu pela humanidade.',
      'Está se aproximando da Via Láctea a 110 km/s e as duas galáxias se fundirão em cerca de 4.5 bilhões de anos criando a "Lactômeda".',
      'O Telescópio Espacial Hubble da NASA mapeou mais de 100 milhões de estrelas individuais em seu disco espiral.',
    ],
    tips: 'Em céus escuros, aparece como uma mancha esfumaçada oval com binóculo ou telescópio.',
  },
  {
    id: 'm42_orion_nebula',
    name: 'Grande Nebulosa de Órion (M42)',
    scientificName: 'Messier 42 / NGC 1976',
    type: 'nebula',
    ra: 5.588,
    dec: -5.391,
    mag: 4.0,
    distance: '1.344 anos-luz',
    constellation: 'Órion',
    color: '#f472b6',
    description: 'O mais célebre e ativo berçário estelar visível no céu noturno.',
    facts: [
      'Novas estrelas e sistemas protoplanetários estão nascendo dentro de seus filamentos de gás hidrogênio e poeira.',
      'No coração da nebulosa fica o aglomerado estelar do Trapézio, cujas jovens estrelas ionizam o gás ao redor.',
      'Imagens recentes do Telescópio Espacial James Webb (JWST) revelaram dezenas de planetas gigantes errantes (JuMBOs) flutuando livres.',
    ],
    tips: 'Fica na "Espada de Órion", logo abaixo do Cinturão das Três Marias. Deslumbrante em qualquer telescópio amador.',
  },
  {
    id: 'm45_pleiades',
    name: 'Aglomerado das Plêiades (M45 / Sete Estrelo)',
    scientificName: 'Messier 45 (As Sete Irmãs)',
    type: 'cluster',
    ra: 3.79,
    dec: 24.11,
    mag: 1.6,
    distance: '444 anos-luz',
    constellation: 'Touro (Taurus)',
    color: '#38bdf8',
    description: 'O mais belo aglomerado estelar aberto do céu, famoso pelas suas estrelas azuis e nebulosa de reflexão.',
    facts: [
      'Conhecido popularmente no Brasil como o "Sete Estrelo".',
      'As estrelas têm apenas 100 milhões de anos de idade (muito jovens na escala cósmica).',
      'Inspirou o logotipo da montadora japonesa Subaru (Subaru é o nome das Plêiades em japonês).',
    ],
    tips: 'Espetacular em binóculos 7x50 ou 10x50, onde dezenas de estrelas reluzentes aparecem como diamantes cósmicos.',
  },
  {
    id: 'ngc_3372_carina',
    name: 'Nebulosa de Carina (NGC 3372)',
    scientificName: 'Grande Nebulosa da Quilha',
    type: 'nebula',
    ra: 10.75,
    dec: -59.87,
    mag: 1.0,
    distance: '7.500 anos-luz',
    constellation: 'Carina (Quilha)',
    color: '#fb7185',
    description: 'Uma das maiores e mais brilhantes nebulosas difusas do cosmos, lar da hipergigante Eta Carinae.',
    facts: [
      'É quatro vezes maior e mais brilhante que a Nebulosa de Órion!',
      'Abriga a estrela Eta Carinae, uma das estrelas mais massivas e instáveis da nossa galáxia, prestes a explodir em hipernova.',
      'Foi um dos primeiros alvos cósmicos revelados em alta resolução pelo telescópio espacial James Webb da NASA.',
    ],
    tips: 'Excelente alvo no hemisfério sul, facilmente observável ao lado do Cruzeiro do Sul.',
  },
  {
    id: 'lmc_magellanic',
    name: 'Grande Nuvem de Magalhães (LMC)',
    scientificName: 'Large Magellanic Cloud',
    type: 'galaxy',
    ra: 5.39,
    dec: -69.75,
    mag: 0.9,
    distance: '158.000 anos-luz',
    constellation: 'Dourado / Mensa',
    color: '#a78bfa',
    description: 'Galáxia satélite anã da Via Láctea, rica em berçários estelares como a Nebulosa da Tarântula.',
    facts: [
      'Visível exclusivamente a partir do hemisfério sul.',
      'Foi o local da Supernova 1987A, a supernova mais próxima observada nos tempos modernos.',
    ],
    tips: 'Aparece como uma nuvem luminosa destacada no céu noturno distante das luzes da cidade.',
  },
  {
    id: 'iss_space_station',
    name: 'Estação Espacial Internacional (ISS)',
    scientificName: 'ISS (ZARYA / NASA / ESA / JAXA)',
    type: 'satellite',
    ra: 12.0,
    dec: -20.0,
    mag: -3.5,
    distance: '420 km de altitude',
    constellation: 'Órbita Terrestre Baixa',
    color: '#34d399',
    description: 'O maior laboratório espacial habitado da humanidade, orbitando a Terra a 27.600 km/h.',
    facts: [
      'Dá uma volta completa na Terra a cada 90 minutos, testemunhando 16 pores e nasceres do sol por dia.',
      'Possui painéis solares do tamanho de um campo de futebol que refletem intensamente a luz solar.',
      'Habitada ininterruptamente por astronautas e cosmonautas desde novembro de 2000.',
    ],
    tips: 'Cruza o céu rapidamente em cerca de 4 a 6 minutos como um ponto branco brilhante constante e sem piscar.',
  },
  {
    id: 'jwst_telescope',
    name: 'Telescópio Espacial James Webb (JWST)',
    scientificName: 'James Webb Space Telescope (NASA / ESA / CSA)',
    type: 'satellite',
    ra: 18.0,
    dec: -25.0,
    mag: 15.0,
    distance: '1.5 milhão de km (Ponto Lagrange L2)',
    constellation: 'Espaço Profundo L2',
    color: '#eab308',
    description: 'O observatório espacial infravermelho mais poderoso já construído pela humanidade.',
    facts: [
      'Possui um espelho primário de berílio banhado a ouro de 6.5 metros de diâmetro.',
      'Opera a temperaturas criogênicas de -233°C protegido por um escudo solar de 5 camadas do tamanho de uma quadra de tênis.',
      'Está desvendando as primeiras galáxias formadas após o Big Bang e atmosferas de exoplanetas habitáveis.',
    ],
    tips: 'Localizado no ponto gravitacional de Lagrange L2 atrás da Terra.',
  },
];

/**
 * Major Constellations with their key stars and connections
 */
export const CONSTELLATIONS_CATALOG: ConstellationData[] = [
  {
    id: 'crux',
    name: 'Cruzeiro do Sul',
    latinName: 'Crux',
    brazilianName: 'Cruzeiro do Sul / Ema Celestial (Tupi-Guarani)',
    centerRa: 12.5,
    centerDec: -60.0,
    season: 'Circumpolar Sul',
    description: 'A menor e mais famosa de todas as 88 constelações modernas, guia fundamental do hemisfério sul.',
    mythology: 'Para os indígenas Tupi-Guarani do Brasil, o Cruzeiro do Sul representa o bico e a cabeça da grande "Ema Celestial" (Guyra Nhandu) desenhada nas estrelas e poeira da Via Láctea.',
    lines: [[0, 2], [1, 3], [0, 4]], // connections
    stars: [
      {
        id: 'crux_acrux',
        name: 'Acrux (Alpha Crucis)',
        scientificName: 'Alpha Crucis',
        type: 'star',
        ra: 12.443,
        dec: -63.099,
        mag: 0.77,
        distance: '320 anos-luz',
        constellation: 'Cruzeiro do Sul',
        color: '#60a5fa',
        description: 'A base da cruz.',
        facts: ['Estrela do estado de São Paulo.'],
      },
      {
        id: 'crux_mimosa',
        name: 'Mimosa (Beta Crucis)',
        scientificName: 'Beta Crucis',
        type: 'star',
        ra: 12.795,
        dec: -59.688,
        mag: 1.25,
        distance: '280 anos-luz',
        constellation: 'Cruzeiro do Sul',
        color: '#93c5fd',
        description: 'O braço esquerdo da cruz.',
        facts: ['Estrela do estado do Rio de Janeiro.'],
      },
      {
        id: 'crux_gacrux',
        name: 'Gacrux (Gamma Crucis)',
        scientificName: 'Gamma Crucis',
        type: 'star',
        ra: 12.518,
        dec: -57.113,
        mag: 1.64,
        distance: '88 anos-luz',
        constellation: 'Cruzeiro do Sul',
        color: '#f97316',
        description: 'O topo da cruz, uma gigante vermelha.',
        facts: ['Estrela do estado da Bahia.'],
      },
      {
        id: 'crux_palida',
        name: 'Imai (Delta Crucis)',
        scientificName: 'Delta Crucis',
        type: 'star',
        ra: 12.251,
        dec: -58.749,
        mag: 2.79,
        distance: '345 anos-luz',
        constellation: 'Cruzeiro do Sul',
        color: '#93c5fd',
        description: 'O braço direito da cruz.',
        facts: ['Estrela do estado de Minas Gerais.'],
      },
      {
        id: 'crux_intrometida',
        name: 'Intrometida (Epsilon Crucis)',
        scientificName: 'Epsilon Crucis',
        type: 'star',
        ra: 12.355,
        dec: -60.401,
        mag: 3.59,
        distance: '230 anos-luz',
        constellation: 'Cruzeiro do Sul',
        color: '#fdba74',
        description: 'A famosa estrela menorzinha dentro da cruz.',
        facts: ['Estrela do estado do Espírito Santo.'],
      },
    ],
  },
  {
    id: 'orion',
    name: 'Órion (O Caçador)',
    latinName: 'Orion',
    brazilianName: 'Órion / As Três Marias / O Homem Velho (Tuypiré)',
    centerRa: 5.5,
    centerDec: 0.0,
    season: 'Verão',
    description: 'A mais majestosa constelação do céu noturno, visível de ambos os hemisférios com as Três Marias no centro.',
    mythology: 'Na mitologia grega, Órion foi um caçador gigante que se gabava de poder caçar qualquer criatura viva na Terra. No folclore brasileiro e português, o cinturão é carinhosamente chamado de "As Três Marias".',
    lines: [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6]], // Betelgeuse, Bellatrix, Saiph, Rigel + Cinturão
    stars: [
      {
        id: 'orion_betelgeuse',
        name: 'Betelgeuse',
        scientificName: 'Alpha Orionis',
        type: 'star',
        ra: 5.919,
        dec: 7.407,
        mag: 0.5,
        distance: '640 anos-luz',
        constellation: 'Órion',
        color: '#f87171',
        description: 'Supergigante vermelha no ombro.',
        facts: ['Prestes a explodir em supernova.'],
      },
      {
        id: 'orion_bellatrix',
        name: 'Bellatrix',
        scientificName: 'Gamma Orionis',
        type: 'star',
        ra: 5.419,
        dec: 6.349,
        mag: 1.64,
        distance: '250 anos-luz',
        constellation: 'Órion',
        color: '#67e8f9',
        description: 'Estrela Guerreira no outro ombro.',
        facts: ['Gigante azul quente.'],
      },
      {
        id: 'orion_saiph',
        name: 'Saiph',
        scientificName: 'Kappa Orionis',
        type: 'star',
        ra: 5.795,
        dec: -9.669,
        mag: 2.07,
        distance: '650 anos-luz',
        constellation: 'Órion',
        color: '#93c5fd',
        description: 'Pé direito de Órion.',
        facts: ['Supergigante luminosa.'],
      },
      {
        id: 'orion_rigel',
        name: 'Rigel',
        scientificName: 'Beta Orionis',
        type: 'star',
        ra: 5.242,
        dec: -8.201,
        mag: 0.13,
        distance: '860 anos-luz',
        constellation: 'Órion',
        color: '#93c5fd',
        description: 'Supergigante azul no pé esquerdo.',
        facts: ['Brilha como 120.000 Sóis.'],
      },
      {
        id: 'orion_alnitak',
        name: 'Alnitak (Maria)',
        scientificName: 'Zeta Orionis',
        type: 'star',
        ra: 5.679,
        dec: -1.942,
        mag: 1.74,
        distance: '1.260 anos-luz',
        constellation: 'Órion',
        color: '#67e8f9',
        description: 'Primeira das Três Marias.',
        facts: ['Próxima à famosa Nebulosa Cabeça de Cavalo.'],
      },
      {
        id: 'orion_alnilam',
        name: 'Alnilam (Maria)',
        scientificName: 'Epsilon Orionis',
        type: 'star',
        ra: 5.603,
        dec: -1.201,
        mag: 1.69,
        distance: '2.000 anos-luz',
        constellation: 'Órion',
        color: '#93c5fd',
        description: 'A Três Maria central.',
        facts: ['Supergigante azul extremamente distante e luminosa.'],
      },
      {
        id: 'orion_mintaka',
        name: 'Mintaka (Maria)',
        scientificName: 'Delta Orionis',
        type: 'star',
        ra: 5.533,
        dec: -0.299,
        mag: 2.23,
        distance: '1.200 anos-luz',
        constellation: 'Órion',
        color: '#67e8f9',
        description: 'Terceira das Três Marias, quase exatamente sobre o equador celeste.',
        facts: ['Fica a 0° de declinação.'],
      },
    ],
  },
  {
    id: 'scorpius',
    name: 'Escorpião',
    latinName: 'Scorpius',
    brazilianName: 'Escorpião',
    centerRa: 16.5,
    centerDec: -30.0,
    season: 'Inverno',
    description: 'Uma das constelações mais fiéis ao seu desenho, desenhando um gancho com ferrão perfeito no céu.',
    mythology: 'O escorpião gigante enviado pela deusa Gaia para derrotar o caçador Órion. Por essa razão, os deuses os colocaram em lados opostos do céu: quando Escorpião nasce, Órion se põe.',
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
    stars: [
      {
        id: 'scorp_graffias',
        name: 'Acrab (Graffias)',
        scientificName: 'Beta Scorpii',
        type: 'star',
        ra: 16.09,
        dec: -19.8,
        mag: 2.56,
        distance: '400 anos-luz',
        constellation: 'Escorpião',
        color: '#93c5fd',
        description: 'Cabeça do escorpião.',
        facts: ['Sistema múltiplo.'],
      },
      {
        id: 'scorp_dschubba',
        name: 'Dschubba',
        scientificName: 'Delta Scorpii',
        type: 'star',
        ra: 16.0,
        dec: -22.62,
        mag: 2.29,
        distance: '490 anos-luz',
        constellation: 'Escorpião',
        color: '#93c5fd',
        description: 'Fronte do escorpião.',
        facts: ['Estrela variável.'],
      },
      {
        id: 'scorp_antares',
        name: 'Antares',
        scientificName: 'Alpha Scorpii',
        type: 'star',
        ra: 16.49,
        dec: -26.432,
        mag: 0.96,
        distance: '550 anos-luz',
        constellation: 'Escorpião',
        color: '#ef4444',
        description: 'O coração avermelhado do escorpião.',
        facts: ['Supergigante vermelha colossal.'],
      },
      {
        id: 'scorp_wei',
        name: 'Wei (Epsilon Scorpii)',
        scientificName: 'Epsilon Scorpii',
        type: 'star',
        ra: 16.83,
        dec: -34.29,
        mag: 2.29,
        distance: '63 anos-luz',
        constellation: 'Escorpião',
        color: '#fdba74',
        description: 'Corpo do escorpião.',
        facts: ['Gigante laranja próxima.'],
      },
      {
        id: 'scorp_sargas',
        name: 'Sargas (Theta Scorpii)',
        scientificName: 'Theta Scorpii',
        type: 'star',
        ra: 17.62,
        dec: -42.99,
        mag: 1.87,
        distance: '300 anos-luz',
        constellation: 'Escorpião',
        color: '#fef08a',
        description: 'Início da curva da cauda.',
        facts: ['Gigante brilhante.'],
      },
      {
        id: 'scorp_shaula',
        name: 'Shaula (O Ferrão)',
        scientificName: 'Lambda Scorpii',
        type: 'star',
        ra: 17.56,
        dec: -37.1,
        mag: 1.62,
        distance: '570 anos-luz',
        constellation: 'Escorpião',
        color: '#93c5fd',
        description: 'A ponta do ferrão venenoso.',
        facts: ['Segunda mais brilhante de Escorpião.'],
      },
    ],
  },
  {
    id: 'ursa_major',
    name: 'Ursa Maior',
    latinName: 'Ursa Major',
    brazilianName: 'Ursa Maior (O Grande Carro)',
    centerRa: 11.5,
    centerDec: 55.0,
    season: 'Primavera',
    description: 'A mais célebre constelação do hemisfério norte com o padrão do "Grande Carro" (Big Dipper).',
    mythology: 'Na lenda grega, representa a ninfa Calisto transformada em urso pela ciumenta deusa Hera.',
    lines: [[0, 1], [1, 2], [2, 3], [3, 0], [2, 4], [4, 5], [5, 6]],
    stars: [
      {
        id: 'um_dubhe',
        name: 'Dubhe',
        scientificName: 'Alpha Ursae Majoris',
        type: 'star',
        ra: 11.06,
        dec: 61.75,
        mag: 1.79,
        distance: '123 anos-luz',
        constellation: 'Ursa Maior',
        color: '#fdba74',
        description: 'Ponteiro para a Estrela Polar.',
        facts: ['Gigante laranja.'],
      },
      {
        id: 'um_merak',
        name: 'Merak',
        scientificName: 'Beta Ursae Majoris',
        type: 'star',
        ra: 11.03,
        dec: 56.38,
        mag: 2.37,
        distance: '79 anos-luz',
        constellation: 'Ursa Maior',
        color: '#bae6fd',
        description: 'Ponteiro inferior do carro.',
        facts: ['Estrela branca da sequência principal.'],
      },
      {
        id: 'um_phecda',
        name: 'Phecda',
        scientificName: 'Gamma Ursae Majoris',
        type: 'star',
        ra: 11.9,
        dec: 53.69,
        mag: 2.44,
        distance: '83 anos-luz',
        constellation: 'Ursa Maior',
        color: '#93c5fd',
        description: 'Base traseira do carro.',
        facts: ['Estrela jovem.'],
      },
      {
        id: 'um_megrez',
        name: 'Megrez',
        scientificName: 'Delta Ursae Majoris',
        type: 'star',
        ra: 12.25,
        dec: 57.03,
        mag: 3.31,
        distance: '80 anos-luz',
        constellation: 'Ursa Maior',
        color: '#93c5fd',
        description: 'Junção da cauda com o corpo.',
        facts: ['A mais fraca do asterismo principal.'],
      },
      {
        id: 'um_alioth',
        name: 'Alioth',
        scientificName: 'Epsilon Ursae Majoris',
        type: 'star',
        ra: 12.9,
        dec: 55.96,
        mag: 1.76,
        distance: '82 anos-luz',
        constellation: 'Ursa Maior',
        color: '#93c5fd',
        description: 'Primeira estrela da cauda curva.',
        facts: ['A mais brilhante da Ursa Maior.'],
      },
      {
        id: 'um_mizar',
        name: 'Mizar & Alcor',
        scientificName: 'Zeta Ursae Majoris',
        type: 'star',
        ra: 13.4,
        dec: 54.92,
        mag: 2.23,
        distance: '83 anos-luz',
        constellation: 'Ursa Maior',
        color: '#93c5fd',
        description: 'Famoso par binário usado no passado como teste de acuidade visual para arqueiros árabes.',
        facts: ['Primeira binária espectroscópica descoberta na história.'],
      },
      {
        id: 'um_alkaid',
        name: 'Alkaid',
        scientificName: 'Eta Ursae Majoris',
        type: 'star',
        ra: 13.79,
        dec: 49.31,
        mag: 1.86,
        distance: '103 anos-luz',
        constellation: 'Ursa Maior',
        color: '#93c5fd',
        description: 'Ponta extrema da cauda da Ursa.',
        facts: ['Estrela jovem muito quente.'],
      },
    ],
  },
];

/**
 * Computes all visible celestial bodies for given observer and timestamp
 */
export function getAllVisibleObjects(
  observer: ObserverCoords,
  date: Date = new Date()
): CelestialObject[] {
  const { latitude, longitude } = observer;
  const result: CelestialObject[] = [];

  // 1. Solar system objects
  const solarSystem = calculateSolarSystem(date, latitude, longitude);
  result.push(...solarSystem);

  // 2. Bright stars
  BRIGHT_STARS_CATALOG.forEach((star) => {
    const coords = equatorialToHorizontal(star.ra, star.dec, latitude, longitude, date);
    result.push({
      ...star,
      altitude: coords.altitude,
      azimuth: coords.azimuth,
      isVisible: coords.altitude > 0,
    });
  });

  // 3. Deep Sky Objects & Satellites
  DEEP_SKY_CATALOG.forEach((dso) => {
    const coords = equatorialToHorizontal(dso.ra, dso.dec, latitude, longitude, date);
    result.push({
      ...dso,
      altitude: coords.altitude,
      azimuth: coords.azimuth,
      isVisible: coords.altitude > 0,
    });
  });

  return result;
}

/**
 * Finds the celestial object closest to the camera center (target reticle)
 * taking into account angular distance on the sphere.
 */
export function findTargetInReticle(
  azimuthDeg: number,
  altitudeDeg: number,
  objects: CelestialObject[],
  maxAngularDistanceDeg: number = 18
): { target: CelestialObject | null; angularDistance: number; nearby: CelestialObject[] } {
  let closest: CelestialObject | null = null;
  let minDistance = Infinity;
  const nearby: CelestialObject[] = [];

  const azRad1 = azimuthDeg * DEG2RAD;
  const altRad1 = altitudeDeg * DEG2RAD;

  for (const obj of objects) {
    if (obj.altitude == null || obj.azimuth == null) continue;

    const azRad2 = obj.azimuth * DEG2RAD;
    const altRad2 = obj.altitude * DEG2RAD;

    // Haversine / Great Circle Angular Distance on Celestial Sphere
    const cosDist =
      Math.sin(altRad1) * Math.sin(altRad2) +
      Math.cos(altRad1) * Math.cos(altRad2) * Math.cos(azRad1 - azRad2);
    const angDistRad = Math.acos(Math.max(-1, Math.min(1, cosDist)));
    const angDistDeg = angDistRad * RAD2DEG;

    if (angDistDeg <= maxAngularDistanceDeg) {
      nearby.push(obj);
      if (angDistDeg < minDistance) {
        minDistance = angDistDeg;
        closest = obj;
      }
    }
  }

  // Sort nearby objects by brightness (mag ascending)
  nearby.sort((a, b) => a.mag - b.mag);

  return {
    target: closest,
    angularDistance: minDistance,
    nearby: nearby.slice(0, 5),
  };
}

/**
 * Computes 24h diurnal motion track (apparent movement across the sky) for a celestial object.
 * Returns points sampled across -12h to +12h around the current moment.
 */
export function calculateDiurnalMotionTrack(
  obj: CelestialObject,
  lat: number,
  lon: number,
  baseDate: Date = new Date()
): {
  objectId: string;
  objectName: string;
  color: string;
  points: { timeOffsetHours: number; timeLabel: string; altitude: number; azimuth: number; isVisible: boolean }[];
  maxAltitude: number;
} {
  const points: { timeOffsetHours: number; timeLabel: string; altitude: number; azimuth: number; isVisible: boolean }[] = [];
  let maxAltitude = -90;

  // Sample every 30 minutes (-12h to +12h = 49 points)
  for (let offsetHours = -12; offsetHours <= 12; offsetHours += 0.5) {
    const sampleDate = new Date(baseDate.getTime() + offsetHours * 3600000);
    const coords = equatorialToHorizontal(obj.ra, obj.dec, lat, lon, sampleDate);

    let timeLabel = '';
    if (offsetHours === 0) {
      timeLabel = 'AGORA';
    } else if (Number.isInteger(offsetHours)) {
      const sign = offsetHours > 0 ? '+' : '';
      timeLabel = `${sign}${offsetHours}h`;
    }

    if (coords.altitude > maxAltitude) {
      maxAltitude = coords.altitude;
    }

    points.push({
      timeOffsetHours: offsetHours,
      timeLabel,
      altitude: coords.altitude,
      azimuth: coords.azimuth,
      isVisible: coords.altitude > 0,
    });
  }

  return {
    objectId: obj.id,
    objectName: obj.name,
    color: obj.color || '#38bdf8',
    points,
    maxAltitude,
  };
}

/**
 * Computes Ecliptic line points projected to the local sky (Altitude & Azimuth)
 */
export function calculateEclipticLine(
  lat: number,
  lon: number,
  date: Date = new Date()
): { azimuth: number; altitude: number; lonDeg: number; isVisible: boolean }[] {
  const obliquity = 23.439 * DEG2RAD;
  const points: { azimuth: number; altitude: number; lonDeg: number; isVisible: boolean }[] = [];

  // Sample ecliptic longitude every 5 degrees (0 to 360)
  for (let lambdaDeg = 0; lambdaDeg <= 360; lambdaDeg += 5) {
    const lambdaRad = lambdaDeg * DEG2RAD;
    const raRad = Math.atan2(Math.cos(obliquity) * Math.sin(lambdaRad), Math.cos(lambdaRad));
    const decRad = Math.asin(Math.sin(obliquity) * Math.sin(lambdaRad));

    const raHours = ((raRad * RAD2DEG) / 15 + 24) % 24;
    const decDeg = decRad * RAD2DEG;

    const coords = equatorialToHorizontal(raHours, decDeg, lat, lon, date);
    points.push({
      azimuth: coords.azimuth,
      altitude: coords.altitude,
      lonDeg: lambdaDeg,
      isVisible: coords.altitude > -10,
    });
  }

  return points;
}

/**
 * Computes Celestial Equator points (Dec = 0°, RA = 0h to 24h)
 */
export function calculateCelestialEquator(
  lat: number,
  lon: number,
  date: Date = new Date()
): { azimuth: number; altitude: number; raHours: number }[] {
  const points: { azimuth: number; altitude: number; raHours: number }[] = [];

  for (let raHours = 0; raHours <= 24; raHours += 0.5) {
    const coords = equatorialToHorizontal(raHours, 0, lat, lon, date);
    points.push({
      azimuth: coords.azimuth,
      altitude: coords.altitude,
      raHours,
    });
  }

  return points;
}

/**
 * Calculates Subsolar Point on Earth (latitude & longitude where Sun is at zenith)
 */
export function calculateSubsolarPoint(date: Date = new Date()): { latitude: number; longitude: number } {
  const jd = getJulianDate(date);
  const d = jd - 2451545.0;

  const sunMeanLon = (280.46 + 0.9856474 * d) % 360;
  const sunMeanAnomaly = (357.528 + 0.9856003 * d) * DEG2RAD;
  const sunEclipticLon =
    (sunMeanLon +
      1.915 * Math.sin(sunMeanAnomaly) +
      0.02 * Math.sin(2 * sunMeanAnomaly)) *
    DEG2RAD;
  const obliquity = 23.439 * DEG2RAD;

  // Subsolar Latitude = Sun Declination
  const decRad = Math.asin(Math.sin(obliquity) * Math.sin(sunEclipticLon));
  const subsolarLat = decRad * RAD2DEG;

  // Subsolar Longitude = Greenwich Sidereal Time related to Sun RA
  const sunRaRad = Math.atan2(Math.cos(obliquity) * Math.sin(sunEclipticLon), Math.cos(sunEclipticLon));
  const sunRaDeg = (sunRaRad * RAD2DEG + 360) % 360;

  const gmstHours = getGMST(date);
  const gmstDeg = gmstHours * 15;

  let subsolarLon = sunRaDeg - gmstDeg;
  subsolarLon = ((subsolarLon + 180) % 360 + 360) % 360 - 180; // -180 to 180

  return { latitude: subsolarLat, longitude: subsolarLon };
}
