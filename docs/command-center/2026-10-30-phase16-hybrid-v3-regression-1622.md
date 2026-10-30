# Phase16 Hybrid V3 16:22 regression

READ_ONLY, writes=0. EP-00571 holds=[]; EP-00631 globe.asahi.com article extracted but UNCLASSIFIED_BODY_URL remains. EP-01069 スポンジ: 3 article pairs, 2 cast lines, but platform labels Spotify/Apple/Pocket Casts/Amazon music remain in body and UNCLASSIFIED_BODY_URL. EP-06642 ドーナツ: 3 article pairs, 3 cast lines, but おたよりフォーム invitation remains in body and UNCLASSIFIED_BODY_URL.

The V3 extraction is NOT certified for W/AC writes. Next: identify the precise remaining unclassified URLs and their source section, preserve body and recording date, distinguish platform-follow blocks and solicitation links, then run V4 READ_ONLY regression. Do not globally suppress URL holds or overwrite already-filled W cells.