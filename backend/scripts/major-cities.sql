Processed 210682 lines from GeoNames
Found 236 major cities (population > 50,000)

--- SQL to import major cities ---

-- Clear existing German cities first (optional):
-- DELETE FROM cities WHERE country_id = 506 AND type = 'city';

-- Insert major German cities with population:
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Berlin', 506, 114, 'city', 52.52437, 13.41053); -- Pop: 3,426,354
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Hamburg', 506, 117, 'city', 53.55073, 9.99302); -- Pop: 1,845,229
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Munich', 506, 113, 'city', 48.13743, 11.57549); -- Pop: 1,260,391
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Köln', 506, 121, 'city', 50.93333, 6.95); -- Pop: 963,395
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Frankfurt am Main', 506, 118, 'city', 50.11552, 8.68417); -- Pop: 650,000
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Stuttgart', 506, 112, 'city', 48.78232, 9.17702); -- Pop: 630,305
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Düsseldorf', 506, 121, 'city', 51.22172, 6.77616); -- Pop: 620,523
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Essen', 506, 121, 'city', 51.45657, 7.01228); -- Pop: 593,085
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Dortmund', 506, 121, 'city', 51.51494, 7.466); -- Pop: 588,462
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Dresden', 506, 124, 'city', 51.05089, 13.73832); -- Pop: 556,227
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Bremen', 506, 116, 'city', 53.07582, 8.80717); -- Pop: 546,501
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Nürnberg', 506, 113, 'city', 49.45421, 11.07752); -- Pop: 515,543
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Hannover', 506, 119, 'city', 52.37052, 9.73322); -- Pop: 515,140
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Leipzig', 506, 124, 'city', 51.33962, 12.37129); -- Pop: 504,971
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Duisburg', 506, 121, 'city', 51.43247, 6.76516); -- Pop: 504,358
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Wandsbek', 506, 117, 'city', 53.58334, 10.08305); -- Pop: 411,422
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Bochum', 506, 121, 'city', 51.48165, 7.21648); -- Pop: 385,729
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Wuppertal', 506, 121, 'city', 51.25627, 7.14816); -- Pop: 360,797
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Bielefeld', 506, 121, 'city', 52.03333, 8.53333); -- Pop: 331,906
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Bonn', 506, 121, 'city', 50.73438, 7.09549); -- Pop: 330,579
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Hamburg-Nord', 506, 117, 'city', 53.58935, 9.984); -- Pop: 315,514
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Mannheim', 506, 112, 'city', 49.4891, 8.46694); -- Pop: 307,960
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Hamburg-Mitte', 506, 117, 'city', 53.55, 10.01667); -- Pop: 301,231
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Marienthal', 506, 117, 'city', 53.56667, 10.08333); -- Pop: 287,101
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Karlsruhe', 506, 112, 'city', 49.00937, 8.40444); -- Pop: 283,799
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Wiesbaden', 506, 118, 'city', 50.08601, 8.24435); -- Pop: 278,609
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Münster', 506, 121, 'city', 51.96236, 7.62571); -- Pop: 270,184
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Gelsenkirchen', 506, 121, 'city', 51.50508, 7.09654); -- Pop: 270,028
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Eimsbüttel', 506, 117, 'city', 53.57416, 9.95679); -- Pop: 269,118
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Aachen', 506, 121, 'city', 50.77664, 6.08342); -- Pop: 265,208
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Mönchengladbach', 506, 121, 'city', 51.18539, 6.44172); -- Pop: 261,742
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Augsburg', 506, 113, 'city', 48.37154, 10.89851); -- Pop: 259,196
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Altona', 506, 117, 'city', 53.55, 9.93333); -- Pop: 250,192
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Chemnitz', 506, 124, 'city', 50.8357, 12.92922); -- Pop: 247,220
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Kiel', 506, 126, 'city', 54.32133, 10.13489); -- Pop: 246,601
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Braunschweig', 506, 119, 'city', 52.26594, 10.52673); -- Pop: 244,715
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Krefeld', 506, 121, 'city', 51.33645, 6.55381); -- Pop: 237,984
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Halle (Saale)', 506, 125, 'city', 51.48158, 11.97947); -- Pop: 237,865
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Magdeburg', 506, 125, 'city', 52.13129, 11.63189); -- Pop: 235,775
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Neue Neustadt', 506, 125, 'city', 52.15, 11.63333); -- Pop: 226,851
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Oberhausen', 506, 121, 'city', 51.47805, 6.8625); -- Pop: 219,176
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Mainz', 506, 122, 'city', 49.98185, 8.28008); -- Pop: 217,123
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Freiburg', 506, 112, 'city', 47.9959, 7.85222); -- Pop: 215,966
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Erfurt', 506, 127, 'city', 50.97734, 11.03536); -- Pop: 213,692
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Lübeck', 506, 126, 'city', 53.86893, 10.68729); -- Pop: 212,207
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Hagen', 506, 121, 'city', 51.36081, 7.47168); -- Pop: 198,972
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Rostock', 506, 120, 'city', 54.0887, 12.14049); -- Pop: 198,293
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Kassel', 506, 118, 'city', 51.31667, 9.5); -- Pop: 194,501
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Potsdam', 506, 115, 'city', 52.39886, 13.06566); -- Pop: 182,112
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Saarbrücken', 506, 123, 'city', 49.23262, 7.00982); -- Pop: 179,349
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Hamm', 506, 121, 'city', 51.68033, 7.82089); -- Pop: 178,967
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Herne', 506, 121, 'city', 51.5388, 7.22572); -- Pop: 172,108
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Mülheim', 506, 121, 'city', 51.43218, 6.87967); -- Pop: 170,921
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Harburg', 506, 117, 'city', 53.46057, 9.98388); -- Pop: 169,221
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Osnabrück', 506, 119, 'city', 52.27264, 8.0498); -- Pop: 166,462
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Neukölln', 506, 114, 'city', 52.47719, 13.43126); -- Pop: 164,636
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Solingen', 506, 121, 'city', 51.17343, 7.0845); -- Pop: 164,359
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Ludwigshafen am Rhein', 506, 122, 'city', 49.48121, 8.44641); -- Pop: 163,196
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Leverkusen', 506, 121, 'city', 51.0303, 6.98432); -- Pop: 162,738
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Oldenburg', 506, 119, 'city', 53.14118, 8.21467); -- Pop: 159,218
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Kreuzberg', 506, 114, 'city', 52.49973, 13.40338); -- Pop: 153,135
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Neuss', 506, 121, 'city', 51.19807, 6.68504); -- Pop: 152,457
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Prenzlauer Berg', 506, 114, 'city', 52.53878, 13.42443); -- Pop: 148,878
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Heidelberg', 506, 112, 'city', 49.40768, 8.69079); -- Pop: 143,345
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Paderborn', 506, 121, 'city', 51.71905, 8.75439); -- Pop: 142,161
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Darmstadt', 506, 118, 'city', 49.87167, 8.65027); -- Pop: 140,385
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Würzburg', 506, 113, 'city', 49.79391, 9.95121); -- Pop: 133,731
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Charlottenburg', 506, 114, 'city', 52.51667, 13.28333); -- Pop: 129,359
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Regensburg', 506, 113, 'city', 49.01513, 12.10161); -- Pop: 129,151
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Wolfsburg', 506, 119, 'city', 52.42452, 10.7815); -- Pop: 123,064
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Schöneberg', 506, 114, 'city', 52.49801, 13.3443); -- Pop: 122,658
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Recklinghausen', 506, 121, 'city', 51.61379, 7.19738); -- Pop: 122,438
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Göttingen', 506, 119, 'city', 51.53443, 9.93228); -- Pop: 122,149
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Heilbronn', 506, 112, 'city', 49.13995, 9.22054); -- Pop: 120,733
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Ingolstadt', 506, 113, 'city', 48.76508, 11.42372); -- Pop: 120,658
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Ulm', 506, 112, 'city', 48.39841, 9.99155); -- Pop: 120,451
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Bottrop', 506, 121, 'city', 51.52392, 6.9285); -- Pop: 119,909
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Bergedorf', 506, 117, 'city', 53.48462, 10.22904); -- Pop: 119,665
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Pforzheim', 506, 112, 'city', 48.88436, 8.69892); -- Pop: 119,313
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Offenbach', 506, 118, 'city', 50.10061, 8.76647); -- Pop: 119,192
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Friedrichshain', 506, 114, 'city', 52.51559, 13.45482); -- Pop: 117,829
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Remscheid', 506, 121, 'city', 51.17983, 7.1925); -- Pop: 117,118
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Bremerhaven', 506, 116, 'city', 53.55357, 8.57553); -- Pop: 113,557
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Nippes', 506, 121, 'city', 50.96545, 6.95314); -- Pop: 113,487
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Porz am Rhein', 506, 121, 'city', 50.88637, 7.0583); -- Pop: 113,415
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Reutlingen', 506, 112, 'city', 48.49144, 9.20427); -- Pop: 112,627
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Fürth', 506, 113, 'city', 49.47593, 10.98856); -- Pop: 112,025
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Marzahn', 506, 114, 'city', 52.54525, 13.56983); -- Pop: 111,508
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Rodenkirchen', 506, 121, 'city', 50.89328, 6.99481); -- Pop: 110,158
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Koblenz', 506, 122, 'city', 50.35357, 7.57883); -- Pop: 107,319
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Siegen', 506, 121, 'city', 50.87481, 8.02431); -- Pop: 107,242
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Bergisch Gladbach', 506, 121, 'city', 50.9856, 7.13298); -- Pop: 106,184
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Jena', 506, 127, 'city', 50.92878, 11.5899); -- Pop: 104,712
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Gera', 506, 127, 'city', 50.88029, 12.08187); -- Pop: 104,659
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Salzgitter', 506, 119, 'city', 52.15705, 10.4154); -- Pop: 103,866
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Moers', 506, 121, 'city', 51.45342, 6.6326); -- Pop: 103,487
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Hildesheim', 506, 119, 'city', 52.15077, 9.95112); -- Pop: 103,052
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Erlangen', 506, 113, 'city', 49.59099, 11.00783); -- Pop: 102,675
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Mitte', 506, 114, 'city', 52.52003, 13.40489); -- Pop: 102,338
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Wilmersdorf', 506, 114, 'city', 52.48333, 13.31667); -- Pop: 101,877
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Witten', 506, 121, 'city', 51.44362, 7.35258); -- Pop: 101,247
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Trier', 506, 122, 'city', 49.75565, 6.63935); -- Pop: 100,129
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Zwickau', 506, 124, 'city', 50.72724, 12.48839); -- Pop: 98,796
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Kaiserslautern', 506, 122, 'city', 49.443, 7.77161); -- Pop: 98,732
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Iserlohn', 506, 121, 'city', 51.37547, 7.70281); -- Pop: 97,910
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Schwerin', 506, 120, 'city', 53.62937, 11.41316); -- Pop: 96,641
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Gütersloh', 506, 121, 'city', 51.90693, 8.37853); -- Pop: 96,180
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Gesundbrunnen', 506, 114, 'city', 52.55035, 13.39139); -- Pop: 93,862
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Düren', 506, 121, 'city', 50.80434, 6.49299); -- Pop: 93,440
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Rahlstedt', 506, 117, 'city', 53.60194, 10.15667); -- Pop: 92,511
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Esslingen', 506, 112, 'city', 48.73961, 9.30473); -- Pop: 92,390
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Ratingen', 506, 121, 'city', 51.29724, 6.84929); -- Pop: 91,606
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Marl', 506, 121, 'city', 51.65671, 7.09038); -- Pop: 91,398
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Lünen', 506, 121, 'city', 51.61634, 7.52872); -- Pop: 91,009
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Hanau am Main', 506, 118, 'city', 50.13423, 8.91418); -- Pop: 88,648
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Velbert', 506, 121, 'city', 51.33537, 7.04348); -- Pop: 87,669
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Ludwigsburg', 506, 112, 'city', 48.89731, 9.19161); -- Pop: 87,603
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Lichterfelde', 506, 114, 'city', 52.4333, 13.30762); -- Pop: 85,885
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Flensburg', 506, 126, 'city', 54.78805, 9.43722); -- Pop: 85,838
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Wedding', 506, 114, 'city', 52.54734, 13.35594); -- Pop: 85,275
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Cottbus', 506, 115, 'city', 51.75769, 14.32888); -- Pop: 84,754
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Wilhelmshaven', 506, 119, 'city', 53.5476, 8.10395); -- Pop: 84,393
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Hellersdorf', 506, 114, 'city', 52.53319, 13.6088); -- Pop: 84,103
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Reinickendorf', 506, 114, 'city', 52.56395, 13.33552); -- Pop: 83,972
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Tübingen', 506, 112, 'city', 48.52266, 9.05222); -- Pop: 83,416
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Minden', 506, 121, 'city', 52.28953, 8.91455); -- Pop: 82,879
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Villingen-Schwenningen', 506, 112, 'city', 48.06226, 8.49358); -- Pop: 81,770
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Konstanz', 506, 112, 'city', 47.66033, 9.17582); -- Pop: 81,275
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Worms', 506, 122, 'city', 49.63278, 8.35916); -- Pop: 81,099
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Moabit', 506, 114, 'city', 52.52635, 13.33903); -- Pop: 81,021
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Neumünster', 506, 126, 'city', 54.07399, 9.98456); -- Pop: 80,196
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Dorsten', 506, 121, 'city', 51.66166, 6.96514); -- Pop: 79,981
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Lüdenscheid', 506, 121, 'city', 51.21977, 7.6273); -- Pop: 79,386
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Marburg an der Lahn', 506, 118, 'city', 50.80904, 8.77069); -- Pop: 78,895
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Rheinhausen', 506, 121, 'city', 51.40055, 6.71187); -- Pop: 78,203
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Castrop-Rauxel', 506, 121, 'city', 51.55657, 7.31155); -- Pop: 77,924
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Bogenhausen', 506, 113, 'city', 48.15221, 11.61585); -- Pop: 77,542
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Gladbeck', 506, 121, 'city', 51.57077, 6.98593); -- Pop: 76,940
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Arnsberg', 506, 121, 'city', 51.38333, 8.08333); -- Pop: 76,612
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Rheine', 506, 121, 'city', 52.28509, 7.44055); -- Pop: 76,491
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Viersen', 506, 121, 'city', 51.25435, 6.39441); -- Pop: 76,153
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Delmenhorst', 506, 119, 'city', 53.0511, 8.63091); -- Pop: 75,893
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Bayreuth', 506, 113, 'city', 49.94782, 11.57893); -- Pop: 75,061
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Troisdorf', 506, 121, 'city', 50.80901, 7.14968); -- Pop: 74,749
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Gießen', 506, 118, 'city', 50.58727, 8.67554); -- Pop: 74,411
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Bocholt', 506, 121, 'city', 51.83879, 6.61531); -- Pop: 73,943
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Detmold', 506, 121, 'city', 51.93855, 8.87318); -- Pop: 73,680
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Steglitz', 506, 114, 'city', 52.45606, 13.332); -- Pop: 72,464
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Norderstedt', 506, 126, 'city', 53.70177, 9.99328); -- Pop: 71,439
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Lüneburg', 506, 119, 'city', 53.2509, 10.41409); -- Pop: 71,260
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Billstedt', 506, 117, 'city', 53.55, 10.13333); -- Pop: 71,077
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Celle', 506, 119, 'city', 52.62264, 10.08047); -- Pop: 71,010
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Dinslaken', 506, 121, 'city', 51.56227, 6.7434); -- Pop: 70,573
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Bamberg', 506, 113, 'city', 49.89873, 10.90067); -- Pop: 70,047
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Aschaffenburg', 506, 113, 'city', 49.97704, 9.15214); -- Pop: 68,551
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Neubrandenburg', 506, 120, 'city', 53.56414, 13.27532); -- Pop: 68,082
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Dessau', 506, 125, 'city', 51.83864, 12.24555); -- Pop: 67,747
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Lippstadt', 506, 121, 'city', 51.67369, 8.34482); -- Pop: 67,219
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Köpenick', 506, 114, 'city', 52.4455, 13.57455); -- Pop: 67,148
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Aalen', 506, 112, 'city', 48.83777, 10.0933); -- Pop: 67,085
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Neuwied', 506, 122, 'city', 50.4336, 7.47057); -- Pop: 66,805
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Unna', 506, 121, 'city', 51.53795, 7.68969); -- Pop: 66,734
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Plauen', 506, 124, 'city', 50.4973, 12.13782); -- Pop: 66,412
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Pankow', 506, 114, 'city', 52.56926, 13.40186); -- Pop: 65,375
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Herten', 506, 121, 'city', 51.59638, 7.14387); -- Pop: 65,306
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Herford', 506, 121, 'city', 52.11457, 8.67343); -- Pop: 64,879
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Grevenbroich', 506, 121, 'city', 51.09102, 6.5827); -- Pop: 64,779
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Weimar', 506, 127, 'city', 50.9803, 11.32903); -- Pop: 64,727
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Kerpen', 506, 121, 'city', 50.86991, 6.69691); -- Pop: 64,226
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Fulda', 506, 118, 'city', 50.55162, 9.67518); -- Pop: 63,760
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Dormagen', 506, 121, 'city', 51.09683, 6.83167); -- Pop: 63,582
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Bergheim', 506, 121, 'city', 50.95572, 6.63986); -- Pop: 63,558
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Garbsen', 506, 119, 'city', 52.41371, 9.5899); -- Pop: 63,355
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Tempelhof', 506, 114, 'city', 52.46667, 13.4); -- Pop: 61,769
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Wesel', 506, 121, 'city', 51.6669, 6.62037); -- Pop: 61,685
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Kempten (Allgäu)', 506, 113, 'city', 47.72674, 10.31389); -- Pop: 61,399
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Sindelfingen', 506, 112, 'city', 48.7, 9.01667); -- Pop: 61,311
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Schwäbisch Gmünd', 506, 112, 'city', 48.79947, 9.79809); -- Pop: 61,216
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Landshut', 506, 113, 'city', 48.52961, 12.16179); -- Pop: 60,488
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Rosenheim', 506, 113, 'city', 47.85637, 12.12247); -- Pop: 60,167
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Brandenburg an der Havel', 506, 115, 'city', 52.41667, 12.55); -- Pop: 59,826
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Rüsselsheim am Main', 506, 118, 'city', 49.98955, 8.42251); -- Pop: 59,730
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Berlin Köpenick', 506, 114, 'city', 52.44254, 13.58228); -- Pop: 59,561
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Offenburg', 506, 112, 'city', 48.47377, 7.94495); -- Pop: 59,238
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Langenfeld', 506, 121, 'city', 51.10821, 6.94831); -- Pop: 59,112
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Stralsund', 506, 120, 'city', 54.30911, 13.0818); -- Pop: 58,976
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Hameln', 506, 119, 'city', 52.10397, 9.35623); -- Pop: 58,666
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Friedrichshafen', 506, 112, 'city', 47.65689, 9.47554); -- Pop: 58,403
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Göppingen', 506, 112, 'city', 48.70354, 9.65209); -- Pop: 58,040
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Görlitz', 506, 124, 'city', 51.15518, 14.98853); -- Pop: 57,751
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Frankfurt (Oder)', 506, 115, 'city', 52.34714, 14.55062); -- Pop: 57,015
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Neu-Hohenschönhausen', 506, 114, 'city', 52.56681, 13.51255); -- Pop: 56,921
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Hattingen', 506, 121, 'city', 51.39894, 7.18557); -- Pop: 56,866
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Hilden', 506, 121, 'city', 51.16818, 6.93093); -- Pop: 56,565
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Winterhude', 506, 117, 'city', 53.59368, 10.01123); -- Pop: 56,382
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Stolberg', 506, 121, 'city', 50.77368, 6.22595); -- Pop: 56,377
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Sankt Augustin', 506, 121, 'city', 50.77538, 7.197); -- Pop: 56,094
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Eschweiler', 506, 121, 'city', 50.81854, 6.27184); -- Pop: 55,778
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Aplerbeck', 506, 121, 'city', 51.48333, 7.55); -- Pop: 55,588
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Baden-Baden', 506, 112, 'city', 48.7606, 8.23975); -- Pop: 55,449
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Friedrichsfelde', 506, 114, 'city', 52.50575, 13.50812); -- Pop: 55,423
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Ahlen', 506, 121, 'city', 51.76338, 7.8887); -- Pop: 55,280
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Bad Salzuflen', 506, 121, 'city', 52.0862, 8.74434); -- Pop: 54,899
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Euskirchen', 506, 121, 'city', 50.66057, 6.78722); -- Pop: 54,889
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Meerbusch', 506, 121, 'city', 51.25268, 6.68807); -- Pop: 54,826
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Wolfenbüttel', 506, 119, 'city', 52.16442, 10.54095); -- Pop: 54,740
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Hürth', 506, 121, 'city', 50.87079, 6.86761); -- Pop: 54,678
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Zehlendorf', 506, 114, 'city', 52.43333, 13.25); -- Pop: 54,328
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Schweinfurt', 506, 113, 'city', 50.04937, 10.22175); -- Pop: 54,012
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Neustadt an der Weinstraße', 506, 122, 'city', 49.35009, 8.13886); -- Pop: 53,984
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Pulheim', 506, 121, 'city', 50.99965, 6.80632); -- Pop: 53,762
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Gummersbach', 506, 121, 'city', 51.02608, 7.56473); -- Pop: 53,131
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Wilhelmsburg', 506, 117, 'city', 53.49973, 10.01281); -- Pop: 53,064
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Waiblingen', 506, 112, 'city', 48.83241, 9.31641); -- Pop: 52,945
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Nordhorn', 506, 119, 'city', 52.43081, 7.06833); -- Pop: 52,803
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Mariendorf', 506, 114, 'city', 52.4378, 13.38109); -- Pop: 52,734
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Universitäts- und Hansestadt Greifswald', 506, 120, 'city', 54.08905, 13.40244); -- Pop: 52,731
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Cuxhaven', 506, 119, 'city', 53.86828, 8.69902); -- Pop: 52,677
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Wetzlar', 506, 118, 'city', 50.56109, 8.50495); -- Pop: 52,656
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Menden', 506, 121, 'city', 51.44337, 7.77825); -- Pop: 52,452
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Bergkamen', 506, 121, 'city', 51.61633, 7.64451); -- Pop: 52,329
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Lichtenrade', 506, 114, 'city', 52.39844, 13.40637); -- Pop: 52,110
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Bad Homburg vor der Höhe', 506, 118, 'city', 50.22683, 8.61816); -- Pop: 51,859
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Willich', 506, 121, 'city', 51.26371, 6.54734); -- Pop: 51,843
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Emden', 506, 119, 'city', 53.36745, 7.20778); -- Pop: 51,526
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Neu-Ulm', 506, 113, 'city', 48.39279, 10.01112); -- Pop: 51,389
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Lingen', 506, 119, 'city', 52.52143, 7.31845); -- Pop: 51,310
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Erftstadt', 506, 121, 'city', 50.81481, 6.79387); -- Pop: 51,207
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Neubrück', 506, 121, 'city', 51.13434, 6.63857); -- Pop: 51,109
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Ibbenbueren', 506, 121, 'city', 52.27964, 7.71457); -- Pop: 50,577
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Passau', 506, 113, 'city', 48.5665, 13.43122); -- Pop: 50,560
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Langenhagen', 506, 119, 'city', 52.44758, 9.73741); -- Pop: 50,439
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Schwerte', 506, 121, 'city', 51.44387, 7.5675); -- Pop: 50,399
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Speyer', 506, 122, 'city', 49.32083, 8.43111); -- Pop: 50,343
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Alt-Hohenschönhausen', 506, 114, 'city', 52.54608, 13.5013); -- Pop: 50,070
INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) VALUES ('Heidenheim an der Brenz', 506, 112, 'city', 48.67798, 10.15162); -- Pop: 50,067

-- Total: 236 cities

-- Cities per state:
-- State ID 121: 83 cities
-- State ID 114: 27 cities
-- State ID 112: 23 cities
-- State ID 119: 20 cities
-- State ID 113: 18 cities
-- State ID 117: 13 cities
-- State ID 118: 12 cities
-- State ID 122: 9 cities
-- State ID 124: 6 cities
-- State ID 120: 5 cities
-- State ID 126: 5 cities
-- State ID 115: 4 cities
-- State ID 125: 4 cities
-- State ID 127: 4 cities
-- State ID 116: 2 cities
-- State ID 123: 1 cities
