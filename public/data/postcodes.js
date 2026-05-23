// Curated London postcode dataset for the Outra Removers prototype.
// `dmPerWeek` is a hand-picked stable estimate between 100–200 weighted loosely
// by district density (dense inner-London higher, suburban outer lower).
// Replace this with a real lookup (postcodes.io or an internal Outra dataset)
// before production.
window.POSTCODES = [
  // Central / EC / WC
  { code: 'EC1A', area: 'St Bartholomew\u2019s',      dmPerWeek: 142 },
  { code: 'EC1V', area: 'Old Street',                  dmPerWeek: 178 },
  { code: 'EC2A', area: 'Shoreditch',                  dmPerWeek: 195 },
  { code: 'EC2Y', area: 'Barbican',                    dmPerWeek: 124 },
  { code: 'EC3N', area: 'Tower Hill',                  dmPerWeek: 138 },
  { code: 'EC4A', area: 'Fleet Street',                dmPerWeek: 115 },
  { code: 'WC1H', area: 'Bloomsbury',                  dmPerWeek: 162 },
  { code: 'WC1N', area: 'Holborn',                     dmPerWeek: 149 },
  { code: 'WC2H', area: 'Covent Garden',               dmPerWeek: 187 },
  { code: 'WC2N', area: 'Charing Cross',               dmPerWeek: 132 },

  // North
  { code: 'N1',   area: 'Islington',                   dmPerWeek: 184 },
  { code: 'N4',   area: 'Finsbury Park',               dmPerWeek: 168 },
  { code: 'N5',   area: 'Highbury',                    dmPerWeek: 156 },
  { code: 'N6',   area: 'Highgate',                    dmPerWeek: 143 },
  { code: 'N7',   area: 'Holloway',                    dmPerWeek: 171 },
  { code: 'N8',   area: 'Crouch End',                  dmPerWeek: 159 },
  { code: 'N10',  area: 'Muswell Hill',                dmPerWeek: 147 },
  { code: 'N16',  area: 'Stoke Newington',             dmPerWeek: 175 },
  { code: 'N19',  area: 'Archway',                     dmPerWeek: 152 },
  { code: 'N22',  area: 'Wood Green',                  dmPerWeek: 138 },

  // North-West
  { code: 'NW1',  area: 'Camden Town',                 dmPerWeek: 191 },
  { code: 'NW3',  area: 'Hampstead',                   dmPerWeek: 167 },
  { code: 'NW5',  area: 'Kentish Town',                dmPerWeek: 158 },
  { code: 'NW6',  area: 'South Hampstead',             dmPerWeek: 172 },
  { code: 'NW8',  area: 'St John\u2019s Wood',         dmPerWeek: 154 },
  { code: 'NW10', area: 'Willesden',                   dmPerWeek: 146 },
  { code: 'NW11', area: 'Golders Green',               dmPerWeek: 141 },

  // East
  { code: 'E1',   area: 'Whitechapel',                 dmPerWeek: 188 },
  { code: 'E2',   area: 'Bethnal Green',               dmPerWeek: 173 },
  { code: 'E3',   area: 'Bow',                         dmPerWeek: 162 },
  { code: 'E5',   area: 'Clapton',                     dmPerWeek: 151 },
  { code: 'E8',   area: 'Hackney Central',             dmPerWeek: 184 },
  { code: 'E9',   area: 'Hackney South',               dmPerWeek: 169 },
  { code: 'E14',  area: 'Canary Wharf',                dmPerWeek: 197 },
  { code: 'E15',  area: 'Stratford',                   dmPerWeek: 181 },
  { code: 'E17',  area: 'Walthamstow',                 dmPerWeek: 155 },
  { code: 'E20',  area: 'Olympic Park',                dmPerWeek: 143 },

  // West
  { code: 'W1D',  area: 'Soho',                        dmPerWeek: 199 },
  { code: 'W1G',  area: 'Marylebone',                  dmPerWeek: 174 },
  { code: 'W1T',  area: 'Fitzrovia',                   dmPerWeek: 168 },
  { code: 'W2',   area: 'Bayswater',                   dmPerWeek: 165 },
  { code: 'W4',   area: 'Chiswick',                    dmPerWeek: 152 },
  { code: 'W6',   area: 'Hammersmith',                 dmPerWeek: 178 },
  { code: 'W8',   area: 'Kensington',                  dmPerWeek: 163 },
  { code: 'W10',  area: 'North Kensington',            dmPerWeek: 149 },
  { code: 'W11',  area: 'Notting Hill',                dmPerWeek: 186 },
  { code: 'W14',  area: 'West Kensington',             dmPerWeek: 141 },

  // South-West
  { code: 'SW1A', area: 'Westminster',                 dmPerWeek: 158 },
  { code: 'SW1W', area: 'Belgravia',                   dmPerWeek: 132 },
  { code: 'SW3',  area: 'Chelsea',                     dmPerWeek: 169 },
  { code: 'SW4',  area: 'Clapham',                     dmPerWeek: 182 },
  { code: 'SW5',  area: 'Earl\u2019s Court',           dmPerWeek: 151 },
  { code: 'SW6',  area: 'Fulham',                      dmPerWeek: 174 },
  { code: 'SW7',  area: 'South Kensington',            dmPerWeek: 161 },
  { code: 'SW8',  area: 'Nine Elms',                   dmPerWeek: 148 },
  { code: 'SW9',  area: 'Brixton',                     dmPerWeek: 179 },
  { code: 'SW10', area: 'West Brompton',               dmPerWeek: 145 },
  { code: 'SW11', area: 'Battersea',                   dmPerWeek: 183 },
  { code: 'SW12', area: 'Balham',                      dmPerWeek: 156 },
  { code: 'SW15', area: 'Putney',                      dmPerWeek: 162 },
  { code: 'SW17', area: 'Tooting',                     dmPerWeek: 167 },
  { code: 'SW18', area: 'Wandsworth',                  dmPerWeek: 158 },
  { code: 'SW19', area: 'Wimbledon',                   dmPerWeek: 153 },

  // South-East
  { code: 'SE1',  area: 'Southwark',                   dmPerWeek: 189 },
  { code: 'SE5',  area: 'Camberwell',                  dmPerWeek: 161 },
  { code: 'SE8',  area: 'Deptford',                    dmPerWeek: 154 },
  { code: 'SE10', area: 'Greenwich',                   dmPerWeek: 172 },
  { code: 'SE11', area: 'Kennington',                  dmPerWeek: 147 },
  { code: 'SE13', area: 'Lewisham',                    dmPerWeek: 159 },
  { code: 'SE15', area: 'Peckham',                     dmPerWeek: 176 },
  { code: 'SE16', area: 'Rotherhithe',                 dmPerWeek: 142 },
  { code: 'SE17', area: 'Walworth',                    dmPerWeek: 165 },
  { code: 'SE22', area: 'East Dulwich',                dmPerWeek: 151 },
  { code: 'SE23', area: 'Forest Hill',                 dmPerWeek: 138 },
  { code: 'SE26', area: 'Sydenham',                    dmPerWeek: 134 }
];
