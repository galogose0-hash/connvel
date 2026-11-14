(function (window) {
  "use strict";

  var STORAGE_KEY = "connvel_admin_store_v1";

  var defaults = {
    novels: [
      {
        id: "putri-sang-kartografer",
        title: "Putri Sang Kartografer",
        author: "Alya Prameswari",
        genre: "Fantasi",
        status: "Ongoing",
        chapters: 24,
        visible: true,
        poster: "assets/images/cover-cartographer.jpg",
        synopsis: "Seorang pembuat peta muda menemukan jalur yang tidak pernah tercatat di peta mana pun, dan rahasia lama kota pelabuhan Vharen mulai terbuka."
      },
      {
        id: "orbit-kesunyian",
        title: "Orbit Kesunyian",
        author: "Kenji Arata",
        genre: "Fiksi Ilmiah",
        status: "Ongoing",
        chapters: 31,
        visible: true,
        poster: "assets/images/cover-orbit.jpg",
        synopsis: "Di stasiun luar angkasa yang sunyi, seorang teknisi menerima pesan dari orbit yang seharusnya kosong."
      },
      {
        id: "surat-surat-dari-pesisir",
        title: "Surat-Surat dari Pesisir",
        author: "Elena Voss",
        genre: "Roman",
        status: "Completed",
        chapters: 42,
        visible: true,
        poster: "assets/images/cover-letters.jpg",
        synopsis: "Tujuh puluh surat tanpa penerima membawa seorang arsiparis kembali ke pesisir yang ia tinggalkan bertahun-tahun lalu."
      },
      {
        id: "rumah-di-bukit-lentera",
        title: "Rumah di Bukit Lentera",
        author: "Rania Aldebaran",
        genre: "Misteri",
        status: "Ongoing",
        chapters: 18,
        visible: true,
        poster: "assets/images/cover-lantern.jpg",
        synopsis: "Sebuah rumah tua di bukit menyalakan lentera setiap malam untuk seseorang yang tak pernah pulang."
      },
      {
        id: "meja-hari-minggu",
        title: "Meja Hari Minggu",
        author: "Mira Halim",
        genre: "Potongan Kehidupan",
        status: "Completed",
        chapters: 16,
        visible: true,
        poster: "assets/images/cover-sunday.jpg",
        synopsis: "Kisah-kisah kecil yang tumbuh di sekitar meja makan keluarga pada hari Minggu."
      },
      {
        id: "garam-dan-kayu-manis",
        title: "Garam & Kayu Manis",
        author: "Theo Mahendra",
        genre: "Sejarah",
        status: "Completed",
        chapters: 37,
        visible: true,
        poster: "assets/images/cover-salt.jpg",
        synopsis: "Di kota pelabuhan abad ke-18, seorang juru masak menyimpan resep yang bisa mengubah arah sejarah."
      },
      {
        id: "lumut-dan-cahaya-bulan",
        title: "Lumut & Cahaya Bulan",
        author: "Wren Ashby",
        genre: "Fantasi",
        status: "Ongoing",
        chapters: 22,
        visible: true,
        poster: "assets/images/cover-moss.jpg",
        synopsis: "Di hutan yang bernapas, seorang penjaga cahaya bulan menemukan jejak yang bukan milik manusia."
      }
    ],
    chapters: [
      {
        id: "putri-bab-1",
        novelId: "putri-sang-kartografer",
        number: 1,
        title: "Peta yang Hilang",
        date: "2026-10-12",
        published: true,
        content: "Hujan turun seperti benang perak di atas Vharen. Di ruang kerja sempitnya, Liora membuka gulungan peta yang tidak pernah ia lihat sebelumnya. Di tepi kertas, tinta mulai bergerak."
      },
      {
        id: "putri-bab-2",
        novelId: "putri-sang-kartografer",
        number: 2,
        title: "Hujan Pertama",
        date: "2026-10-15",
        published: false,
        content: ""
      },
      {
        id: "putri-bab-3",
        novelId: "putri-sang-kartografer",
        number: 3,
        title: "Kota yang Tidak Bernama",
        date: "2026-10-19",
        published: false,
        content: ""
      },
      {
        id: "putri-bab-4",
        novelId: "putri-sang-kartografer",
        number: 4,
        title: "Jejak di Tepi Dermaga",
        date: "2026-10-22",
        published: false,
        content: ""
      },
      {
        id: "putri-bab-5",
        novelId: "putri-sang-kartografer",
        number: 5,
        title: "Pemandu Bermata Kelabu",
        date: "2026-10-26",
        published: false,
        content: ""
      },
      {
        id: "putri-bab-6",
        novelId: "putri-sang-kartografer",
        number: 6,
        title: "Surat dari Ayah",
        date: "2026-10-29",
        published: false,
        content: ""
      },
      {
        id: "putri-bab-7",
        novelId: "putri-sang-kartografer",
        number: 7,
        title: "Garis yang Tidak Pernah Ada",
        date: "2026-11-02",
        published: false,
        content: ""
      },
      {
        id: "putri-bab-8",
        novelId: "putri-sang-kartografer",
        number: 8,
        title: "Lembah Bisu",
        date: "2026-11-04",
        published: false,
        content: ""
      },
      {
        id: "putri-bab-9",
        novelId: "putri-sang-kartografer",
        number: 9,
        title: "Kompas yang Bernyanyi",
        date: "2026-11-06",
        published: false,
        content: ""
      },
      {
        id: "putri-bab-10",
        novelId: "putri-sang-kartografer",
        number: 10,
        title: "Di Bawah Langit Utara",
        date: "2026-11-07",
        published: false,
        content: ""
      },
      {
        id: "putri-bab-11",
        novelId: "putri-sang-kartografer",
        number: 11,
        title: "Pintu di Ujung Peta",
        date: "2026-11-08",
        published: false,
        content: ""
      },
      {
        id: "putri-bab-12",
        novelId: "putri-sang-kartografer",
        number: 12,
        title: "Putri Sang Kartografer",
        date: "2026-11-09",
        published: false,
        content: ""
      }
    ],
    home: {
      spotlight: "putri-sang-kartografer",
      latest: [
        "putri-sang-kartografer",
        "orbit-kesunyian",
        "surat-surat-dari-pesisir",
        "rumah-di-bukit-lentera",
        "meja-hari-minggu",
        "garam-dan-kayu-manis"
      ],
      trending: [
        "putri-sang-kartografer",
        "surat-surat-dari-pesisir",
        "garam-dan-kayu-manis"
      ]
    },
    announcements: [
      {
        id: "ann-1",
        title: "Selamat datang di halaman Pengumuman Connvel",
        body: "Halaman ini akan memuat kabar terbaru seputar Connvel, jadwal rilis, dan informasi penting lainnya untuk pembaca.\n\nNantikan pembaruan berikutnya.",
        date: "2026-11-13",
        visible: true
      }
    ],
    submissions: [
      {
        id: "sub-1",
        name: "Nadia Prameswari",
        email: "nadia.prameswari@email.com",
        phone: "0812 3456 7890",
        novelTitle: "Langit yang Menyimpan Nama",
        chapter: "Bab 1 - Hujan di Stasiun Tua",
        message: "Cerita ini lahir dari kenangan saya tentang stasiun tempat ayah biasa menjemput. Saya ingin membagikannya dengan pembaca Connvel.",
        date: "2026-11-09T09:24:00",
        status: "baru"
      },
      {
        id: "sub-2",
        name: "Rafi Aldiansyah",
        email: "rafi.aldi@email.com",
        phone: "0857 1122 3344",
        novelTitle: "Rumah yang Tak Pernah Tidur",
        chapter: "Bab 1 - Suara di Dinding",
        message: "Saya menulis cerita horor bernuansa keluarga. Apakah Connvel menerima genre misteri dengan unsur supranatural?",
        date: "2026-11-08T18:10:00",
        status: "baru"
      },
      {
        id: "sub-3",
        name: "Sekar Ayu",
        email: "sekar.ayu@email.com",
        phone: "0821 9988 7766",
        novelTitle: "Sepuluh Menit Sebelum Pulang",
        chapter: "Bab 1 - Lampu Kuning",
        message: "Ini kumpulan cerita pendek tentang pekerja lintas kota. Saya lampirkan satu bab pembuka untuk dinilai.",
        date: "2026-11-07T11:42:00",
        status: "dibaca"
      }
    ],
    comments: [
      {
        id: "com-1",
        novelId: "putri-sang-kartografer",
        name: "Klara Mendhuta",
        message: "Tinta yang bergerak sendiri di peta Liora benar-benar bikin merinding. Menunggu bab berikutnya rasanya lama sekali!",
        date: "2026-11-09T20:15:00"
      },
      {
        id: "com-2",
        novelId: "putri-sang-kartografer",
        name: "Dimas Arya",
        message: "Vharen terasa seperti kota yang benar-benar hidup. Tidak sabar mengetahui siapa yang mengirim gulungan peta itu.",
        date: "2026-11-08T14:32:00"
      },
      {
        id: "com-3",
        novelId: "putri-sang-kartografer",
        name: "Ratri Widyaningrum",
        message: "Bacaannya tenang tapi penuh teka-teki. Teori saya: jalur yang tak tercatat itu menuju rumah masa kecil ayahnya.",
        date: "2026-11-07T09:48:00"
      }
    ]
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function load() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return clone(defaults);
      }

      var data = JSON.parse(raw);
      var announcements = Array.isArray(data.announcements)
        ? data.announcements
        : data.announcement && typeof data.announcement === "object"
          ? [Object.assign({ id: "ann-1" }, data.announcement)]
          : clone(defaults.announcements);
      return {
        novels: Array.isArray(data.novels) ? data.novels : clone(defaults.novels),
        chapters: Array.isArray(data.chapters) ? data.chapters : clone(defaults.chapters),
        home: Object.assign({}, defaults.home, data.home || {}),
        announcements: announcements,
        submissions: Array.isArray(data.submissions) ? data.submissions : clone(defaults.submissions),
        comments: Array.isArray(data.comments) ? data.comments : clone(defaults.comments)
      };
    } catch (error) {
      return clone(defaults);
    }
  }

  function save(data) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function reset() {
    window.localStorage.removeItem(STORAGE_KEY);
    return clone(defaults);
  }

  window.ConnvelStore = {
    STORAGE_KEY: STORAGE_KEY,
    defaults: defaults,
    clone: clone,
    load: load,
    save: save,
    reset: reset
  };
})(window);
