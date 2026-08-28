/**
 * Verse of the day, King James Version.
 *
 * Kept as a local list rather than fetched from a Bible API on purpose: the KJV
 * is public domain, the site is a PWA that has to work offline, and a free
 * third-party API is one more thing that can be down or drop its CORS headers.
 * The trade-off is that the list repeats once you get past its length.
 *
 * Chosen around gratitude, steadiness, and rest, to sit alongside a journal.
 */

export type Verse = {
  reference: string
  text: string
}

export const KJV_VERSES: Verse[] = [
  { reference: 'Psalm 118:24', text: 'This is the day which the LORD hath made; we will rejoice and be glad in it.' },
  { reference: '1 Thessalonians 5:18', text: 'In every thing give thanks: for this is the will of God in Christ Jesus concerning you.' },
  { reference: 'Philippians 4:6', text: 'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.' },
  { reference: 'Philippians 4:7', text: 'And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.' },
  { reference: 'Psalm 23:1', text: 'The LORD is my shepherd; I shall not want.' },
  { reference: 'Psalm 23:2', text: 'He maketh me to lie down in green pastures: he leadeth me beside the still waters.' },
  { reference: 'Psalm 46:10', text: 'Be still, and know that I am God.' },
  { reference: 'Proverbs 3:5', text: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding.' },
  { reference: 'Proverbs 3:6', text: 'In all thy ways acknowledge him, and he shall direct thy paths.' },
  { reference: 'Isaiah 40:31', text: 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.' },
  { reference: 'Isaiah 41:10', text: 'Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee.' },
  { reference: 'Matthew 6:34', text: 'Take therefore no thought for the morrow: for the morrow shall take thought for the things of itself. Sufficient unto the day is the evil thereof.' },
  { reference: 'Matthew 11:28', text: 'Come unto me, all ye that labour and are heavy laden, and I will give you rest.' },
  { reference: 'Psalm 100:4', text: 'Enter into his gates with thanksgiving, and into his courts with praise: be thankful unto him, and bless his name.' },
  { reference: 'Psalm 107:1', text: 'O give thanks unto the LORD, for he is good: for his mercy endureth for ever.' },
  { reference: 'Colossians 3:15', text: 'And let the peace of God rule in your hearts, to the which also ye are called in one body; and be ye thankful.' },
  { reference: 'James 1:17', text: 'Every good gift and every perfect gift is from above, and cometh down from the Father of lights.' },
  { reference: 'Romans 8:28', text: 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.' },
  { reference: 'Joshua 1:9', text: 'Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.' },
  { reference: 'Psalm 27:1', text: 'The LORD is my light and my salvation; whom shall I fear? the LORD is the strength of my life; of whom shall I be afraid?' },
  { reference: 'Psalm 34:8', text: 'O taste and see that the LORD is good: blessed is the man that trusteth in him.' },
  { reference: 'Psalm 37:4', text: 'Delight thyself also in the LORD; and he shall give thee the desires of thine heart.' },
  { reference: 'Psalm 51:10', text: 'Create in me a clean heart, O God; and renew a right spirit within me.' },
  { reference: 'Psalm 55:22', text: 'Cast thy burden upon the LORD, and he shall sustain thee: he shall never suffer the righteous to be moved.' },
  { reference: 'Psalm 62:1', text: 'Truly my soul waiteth upon God: from him cometh my salvation.' },
  { reference: 'Psalm 90:12', text: 'So teach us to number our days, that we may apply our hearts unto wisdom.' },
  { reference: 'Psalm 119:105', text: 'Thy word is a lamp unto my feet, and a light unto my path.' },
  { reference: 'Psalm 121:1', text: 'I will lift up mine eyes unto the hills, from whence cometh my help.' },
  { reference: 'Psalm 121:2', text: 'My help cometh from the LORD, which made heaven and earth.' },
  { reference: 'Psalm 139:14', text: 'I will praise thee; for I am fearfully and wonderfully made: marvellous are thy works.' },
  { reference: 'Psalm 143:8', text: 'Cause me to hear thy lovingkindness in the morning; for in thee do I trust.' },
  { reference: 'Proverbs 4:23', text: 'Keep thy heart with all diligence; for out of it are the issues of life.' },
  { reference: 'Proverbs 15:1', text: 'A soft answer turneth away wrath: but grievous words stir up anger.' },
  { reference: 'Proverbs 16:3', text: 'Commit thy works unto the LORD, and thy thoughts shall be established.' },
  { reference: 'Proverbs 16:9', text: 'A man’s heart deviseth his way: but the LORD directeth his steps.' },
  { reference: 'Proverbs 17:22', text: 'A merry heart doeth good like a medicine: but a broken spirit drieth the bones.' },
  { reference: 'Proverbs 27:17', text: 'Iron sharpeneth iron; so a man sharpeneth the countenance of his friend.' },
  { reference: 'Ecclesiastes 3:1', text: 'To every thing there is a season, and a time to every purpose under the heaven.' },
  { reference: 'Ecclesiastes 9:10', text: 'Whatsoever thy hand findeth to do, do it with thy might.' },
  { reference: 'Isaiah 26:3', text: 'Thou wilt keep him in perfect peace, whose mind is stayed on thee: because he trusteth in thee.' },
  { reference: 'Isaiah 43:2', text: 'When thou passest through the waters, I will be with thee; and through the rivers, they shall not overflow thee.' },
  { reference: 'Jeremiah 29:11', text: 'For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.' },
  { reference: 'Lamentations 3:22', text: 'It is of the LORD’S mercies that we are not consumed, because his compassions fail not.' },
  { reference: 'Lamentations 3:23', text: 'They are new every morning: great is thy faithfulness.' },
  { reference: 'Micah 6:8', text: 'He hath shewed thee, O man, what is good; and what doth the LORD require of thee, but to do justly, and to love mercy, and to walk humbly with thy God?' },
  { reference: 'Zephaniah 3:17', text: 'The LORD thy God in the midst of thee is mighty; he will save, he will rejoice over thee with joy.' },
  { reference: 'Matthew 5:16', text: 'Let your light so shine before men, that they may see your good works, and glorify your Father which is in heaven.' },
  { reference: 'Matthew 6:33', text: 'But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.' },
  { reference: 'Mark 11:24', text: 'Therefore I say unto you, What things soever ye desire, when ye pray, believe that ye receive them, and ye shall have them.' },
  { reference: 'Luke 6:31', text: 'And as ye would that men should do to you, do ye also to them likewise.' },
  { reference: 'John 14:27', text: 'Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid.' },
  { reference: 'John 16:33', text: 'These things I have spoken unto you, that in me ye might have peace. In the world ye shall have tribulation: but be of good cheer; I have overcome the world.' },
  { reference: 'Romans 12:12', text: 'Rejoicing in hope; patient in tribulation; continuing instant in prayer.' },
  { reference: 'Romans 15:13', text: 'Now the God of hope fill you with all joy and peace in believing, that ye may abound in hope.' },
  { reference: '1 Corinthians 10:31', text: 'Whether therefore ye eat, or drink, or whatsoever ye do, do all to the glory of God.' },
  { reference: '1 Corinthians 13:4', text: 'Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up.' },
  { reference: '1 Corinthians 15:58', text: 'Therefore, my beloved brethren, be ye stedfast, unmoveable, always abounding in the work of the Lord.' },
  { reference: '2 Corinthians 4:16', text: 'For which cause we faint not; but though our outward man perish, yet the inward man is renewed day by day.' },
  { reference: '2 Corinthians 9:8', text: 'And God is able to make all grace abound toward you; that ye, always having all sufficiency in all things, may abound to every good work.' },
  { reference: '2 Corinthians 12:9', text: 'My grace is sufficient for thee: for my strength is made perfect in weakness.' },
  { reference: 'Galatians 5:22', text: 'But the fruit of the Spirit is love, joy, peace, longsuffering, gentleness, goodness, faith.' },
  { reference: 'Galatians 6:9', text: 'And let us not be weary in well doing: for in due season we shall reap, if we faint not.' },
  { reference: 'Ephesians 4:32', text: 'And be ye kind one to another, tenderhearted, forgiving one another, even as God for Christ’s sake hath forgiven you.' },
  { reference: 'Ephesians 5:20', text: 'Giving thanks always for all things unto God and the Father in the name of our Lord Jesus Christ.' },
  { reference: 'Philippians 4:8', text: 'Whatsoever things are true, whatsoever things are honest, whatsoever things are just, whatsoever things are pure, whatsoever things are lovely — think on these things.' },
  { reference: 'Philippians 4:13', text: 'I can do all things through Christ which strengtheneth me.' },
  { reference: 'Colossians 3:17', text: 'And whatsoever ye do in word or deed, do all in the name of the Lord Jesus, giving thanks to God and the Father by him.' },
  { reference: 'Colossians 3:23', text: 'And whatsoever ye do, do it heartily, as to the Lord, and not unto men.' },
  { reference: '1 Thessalonians 5:16', text: 'Rejoice evermore.' },
  { reference: '2 Timothy 1:7', text: 'For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.' },
  { reference: 'Hebrews 12:1', text: 'Let us lay aside every weight, and the sin which doth so easily beset us, and let us run with patience the race that is set before us.' },
  { reference: 'Hebrews 13:5', text: 'Be content with such things as ye have: for he hath said, I will never leave thee, nor forsake thee.' },
  { reference: 'James 1:2', text: 'My brethren, count it all joy when ye fall into divers temptations.' },
  { reference: 'James 1:19', text: 'Wherefore, my beloved brethren, let every man be swift to hear, slow to speak, slow to wrath.' },
  { reference: 'James 4:10', text: 'Humble yourselves in the sight of the Lord, and he shall lift you up.' },
  { reference: '1 Peter 5:7', text: 'Casting all your care upon him; for he careth for you.' },
  { reference: '1 John 4:19', text: 'We love him, because he first loved us.' },
  { reference: 'Revelation 21:4', text: 'And God shall wipe away all tears from their eyes; and there shall be no more death, neither sorrow, nor crying.' },
  { reference: 'Numbers 6:24', text: 'The LORD bless thee, and keep thee.' },
  { reference: 'Deuteronomy 31:6', text: 'Be strong and of a good courage, fear not, nor be afraid of them: for the LORD thy God, he it is that doth go with thee.' },
]

/** Days since the epoch in local time, so the verse changes at local midnight. */
function dayIndex(date: Date) {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.floor(local.getTime() / 86_400_000)
}

/** Stable for a whole local day, and the same verse for everyone on that day. */
export function getVerseOfTheDay(date = new Date()): Verse {
  return KJV_VERSES[((dayIndex(date) % KJV_VERSES.length) + KJV_VERSES.length) % KJV_VERSES.length]
}
