import { holidayDB } from '../lib/db';
import { singaporeHolidays } from '../lib/holidays';

holidayDB.replaceAll([...singaporeHolidays]);

console.log('Seeded Singapore holidays');
