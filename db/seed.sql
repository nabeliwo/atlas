-- 開発用 fixtures。
-- provider は 'seed' 固定にして、実際の外部施設検索(provider: geoapify など)と衝突させない。
-- 期間フィルター・クラスタリング・複数Visit表現を確認できるよう、年と地域を散らしてある。

DELETE FROM visit_links;
DELETE FROM visits;
DELETE FROM places;
DELETE FROM profile_links;
DELETE FROM profile;

-- ---------- profile ----------
INSERT INTO profile (id, display_name, bio, google_avatar_url) VALUES
  ('profile_1', 'nabeliwo', '記憶に残った場所を地図に置いています。', NULL);

INSERT INTO profile_links (id, profile_id, title, url, sort_order) VALUES
  ('plink_1', 'profile_1', 'Blog', 'https://example.com/blog', 0),
  ('plink_2', 'profile_1', 'GitHub', 'https://github.com/nabeliwo', 1);

-- ---------- places ----------
-- 東京（近接3件: ズームでクラスタが割れることを確認する用）
INSERT INTO places (id, provider, provider_place_id, name, latitude, longitude, address, country_code, region, city, category) VALUES
  ('place_kiyosumi',  'seed', 'seed:kiyosumi',  '清澄庭園',                 35.6811, 139.7996, '東京都江東区清澄3-3-9',        'JP', '東京都', '江東区', 'park'),
  ('place_bluebottle','seed', 'seed:bluebottle','ブルーボトルコーヒー 清澄白河', 35.6795, 139.7975, '東京都江東区平野1-4-8',        'JP', '東京都', '江東区', 'cafe'),
  ('place_mot',       'seed', 'seed:mot',       '東京都現代美術館',           35.6800, 139.8074, '東京都江東区三好4-1-1',        'JP', '東京都', '江東区', 'museum'),
  -- 国内・遠方
  ('place_kenrokuen', 'seed', 'seed:kenrokuen', '兼六園',                   36.5620, 136.6626, '石川県金沢市兼六町1',          'JP', '石川県', '金沢市', 'park'),
  ('place_naoshima',  'seed', 'seed:naoshima',  '地中美術館',                34.4600, 133.9950, '香川県香川郡直島町3449-1',      'JP', '香川県', '直島町', 'museum'),
  -- 海外（世界地図で散らす）
  ('place_louvre',    'seed', 'seed:louvre',    'Musée du Louvre',          48.8606,   2.3376, 'Rue de Rivoli, 75001 Paris',   'FR', 'Île-de-France', 'Paris', 'museum'),
  ('place_tate',      'seed', 'seed:tate',      'Tate Modern',              51.5076,  -0.0994, 'Bankside, London SE1 9TG',     'GB', 'England', 'London', 'museum'),
  ('place_ferry',     'seed', 'seed:ferry',     'Ferry Building Marketplace',37.7955,-122.3937,'1 Ferry Building, San Francisco','US','California','San Francisco','marketplace'),
  ('place_sagrada',   'seed', 'seed:sagrada',   'La Sagrada Família',       41.4036,   2.1744, "Carrer de Mallorca, Barcelona",'ES', 'Catalunya', 'Barcelona', 'attraction'),
  ('place_marina',    'seed', 'seed:marina',    'Gardens by the Bay',        1.2816, 103.8636, '18 Marina Gardens Dr',         'SG', 'Singapore', 'Singapore', 'park');

-- ---------- visits ----------
-- 清澄庭園: 4回（ピンの視覚的な強さの確認用 / 複数年にまたがる）
INSERT INTO visits (id, place_id, visited_date, title, note_markdown) VALUES
  ('visit_kiyosumi_1', 'place_kiyosumi', '2019-04-06', '桜の時期',       '池のまわりを一周した。**磯渡り**の飛び石が楽しい。'),
  ('visit_kiyosumi_2', 'place_kiyosumi', '2022-11-19', NULL,             '紅葉。夕方に行ったら閉園が早くて慌てた。'),
  ('visit_kiyosumi_3', 'place_kiyosumi', '2025-05-31', '休日の散歩',     NULL),
  ('visit_kiyosumi_4', 'place_kiyosumi', '2026-03-28', '今年の桜',       '去年より少し早い。人は多かったけど朝なら平気だった。');

INSERT INTO visits (id, place_id, visited_date, title, note_markdown) VALUES
  ('visit_bluebottle_1', 'place_bluebottle', '2025-05-31', NULL, '清澄庭園の帰りに。天井が高くて落ち着く。'),
  ('visit_bluebottle_2', 'place_bluebottle', '2026-03-28', NULL, NULL),

  ('visit_mot_1', 'place_mot', '2024-08-12', '企画展',        'コレクション展が思ったより良かった。常設だけでも十分時間が溶ける。'),
  ('visit_mot_2', 'place_mot', '2026-06-14', NULL,            NULL),

  ('visit_kenrokuen_1', 'place_kenrokuen', '2023-02-11', '雪吊り',    '雪の兼六園を見たくて冬に行った。朝一番は人が少ない。'),

  ('visit_naoshima_1', 'place_naoshima', '2021-10-02', '直島',       '一日かけて島をまわった。写真が撮れないのが逆に良い。'),
  ('visit_naoshima_2', 'place_naoshima', '2026-05-04', '5年ぶり',    NULL),

  ('visit_louvre_1', 'place_louvre', '2018-09-21', 'はじめてのパリ', '半日では全然足りなかった。'),
  ('visit_louvre_2', 'place_louvre', '2024-10-05', NULL,             '前回見られなかった彫刻のエリアだけを見て回った。'),

  ('visit_tate_1', 'place_tate', '2018-09-27', NULL,                 'タービンホールの大きさに驚く。'),

  ('visit_ferry_1', 'place_ferry', '2023-06-15', '出張の朝',        '朝市をやっていた。コーヒーとペイストリーだけ買って海沿いで食べた。'),

  ('visit_sagrada_1', 'place_sagrada', '2022-04-30', NULL,           '内部の光の入り方が想像と違った。行ってよかった。'),

  ('visit_marina_1', 'place_marina', '2025-12-28', '年末',           'ライトアップの時間に合わせて行った。暑い。');

-- ---------- visit_links ----------
-- OGP は未取得状態（og_fetched_at IS NULL）で入れて、fallback 表示も確認できるようにする。
INSERT INTO visit_links (id, visit_id, url, title, sort_order) VALUES
  ('vlink_1', 'visit_kiyosumi_1', 'https://example.com/blog/kiyosumi-2019', '清澄庭園で桜を見た話', 0),
  ('vlink_2', 'visit_kiyosumi_4', 'https://photos.google.com/share/example-kiyosumi-2026', '写真', 0),
  ('vlink_3', 'visit_naoshima_1', 'https://example.com/blog/naoshima', '直島に行ってきた', 0),
  ('vlink_4', 'visit_naoshima_1', 'https://photos.google.com/share/example-naoshima', '写真', 1),
  ('vlink_5', 'visit_louvre_1',   'https://example.com/blog/paris-2018', 'パリ旅行記', 0),
  ('vlink_6', 'visit_mot_2',      'https://example.com/blog/mot-2026', '東京都現代美術館のメモ', 0),
  ('vlink_7', 'visit_marina_1',   'https://example.com/blog/singapore-2025', 'シンガポール年末', 0);
