import { adzunaScraper } from "./adzuna.js";
import { canadajobsScraper } from "./canadajobs.js";
import { careerbeaconScraper } from "./careerbeacon.js";
import { indeedScraper } from "./indeed.js";
import { jobbankScraper } from "./jobbank.js";
import { monsterScraper } from "./monster.js";
import { nbjobsScraper } from "./nbjobs.js";
import { nljobbankScraper } from "./nljobbank.js";
import { nsjobsScraper } from "./nsjobs.js";
import { remotehubScraper } from "./remotehub.js";
import { simplyhiredScraper } from "./simplyhired.js";
import { talenteggScraper } from "./talentegg.js";
import { workopolisScraper } from "./workopolis.js";

export const scrapers = [
  adzunaScraper,
  indeedScraper,
  jobbankScraper,
  nbjobsScraper,
  nsjobsScraper,
  nljobbankScraper,
  careerbeaconScraper,
  canadajobsScraper,
  remotehubScraper,
  workopolisScraper,
  simplyhiredScraper,
  talenteggScraper,
  monsterScraper,
];
