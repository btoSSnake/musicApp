import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Image, FlatList, TouchableOpacity } from 'react-native';
import { Audio } from 'expo-av';
import * as SQLite from 'expo-sqlite/legacy';

const db = SQLite.openDatabase('musicDatabase');

const initializeDatabase = () => {
  db.transaction(tx => {
    tx.executeSql(
      'DROP TABLE IF EXISTS songs;',
      [],
      () => console.log('Table "songs" dropped successfully.'),
      (_, error) => {
        console.error('Error dropping table:', error);
        return true; // Rollback transaction on error
      }
    );

    tx.executeSql(
      `CREATE TABLE IF NOT EXISTS songs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        uri TEXT NOT NULL,
        image TEXT
      );`,
      [],
      () => console.log('Table "songs" created successfully.'),
      (_, error) => {
        console.error('Error creating table:', error);
        return true; // Rollback transaction on error
      }
    );
  });
};

const insertSong = (title: string, uri: string, image: string) => {
  return new Promise<void>((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'INSERT INTO songs (title, uri, image) VALUES (?, ?, ?);',
        [title, uri, image],
        () => resolve(),
        (_, error) => {
          console.error('Error inserting song:', error);
          reject(error);
          return false;
        }
      );
    });
  });
};

const insertSongs = async () => {
  const hardcodedSongs = [
    { title: 'Barro - Duki', uri: 'https://audio.jukehost.co.uk/SyEabX1oMUCZSBoR9FgGdL0hfQoPh0iG', image: 'https://i.scdn.co/image/ab67616d0000b273c43ff46b46af2ee509267b63' },
    { title: 'Enganchados #20 - DJ Sol', uri: 'https://audio.jukehost.co.uk/bJEkbddNGcu0yPEQm3z2NdUuX3TKH3Q2', image: 'https://yt3.googleusercontent.com/Wb3Tv03dV9EtUMJj6I4yynWVyvX6TGb367TQUlSq33fOHxt0d84ItAvPN0FepmzFCxADPjasRSo=s900-c-k-c0x00ffffff-no-rj' },
    { title: 'Hey Lil Mama - Eladio Carrion ', uri: 'https://audio.jukehost.co.uk/mG4ce1SARwwOBRxUa83lDbNKpH7ZtIi2', image: 'https://i.scdn.co/image/ab67616d0000b273ec105eaf625391e95540ba97' },
    { title: 'Diabla - Kidd Keo', uri: 'https://audio.jukehost.co.uk/MuF9okvPZ8p5vEGof6XVqFwV5jyvnBq2', image: 'https://images.genius.com/df9ae33e3d087adc9df125e65081edd8.1000x1000x1.png' },
    { title: 'Secretos - C.R.O', uri: 'https://audio.jukehost.co.uk/2hDeS6FdQHl6Fm5vhXfLpfi5VoVWte9X', image: 'https://i.scdn.co/image/ab67616d0000b273717a4d2b63685f7b2a3d1b9c' },
  ];

  for (const song of hardcodedSongs) {
    await insertSong(song.title, song.uri, song.image);
  }
};

interface Song {
  id: number;
  title: string;
  uri: string;
  image?: string;
}

export default function App() {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSoundLoaded, setIsSoundLoaded] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const audioRef = useRef(new Audio.Sound());

  const [songs, setSongs] = useState<Song[]>([]);

  useEffect(() => {
    initializeDatabase();
    insertSongs().then(fetchSongs);
  }, []);

  const fetchSongs = () => {
    db.transaction(tx => {
      tx.executeSql(
        'SELECT * FROM songs;',
        [],
        (_, { rows }) => {
          const songsArray = rows._array.map((row: any) => ({
            id: row.id,
            title: row.title,
            uri: row.uri,
            image: row.image,
          }));
          setSongs(songsArray);
        },
        (_, error) => {
          console.error('Error fetching songs:', error);
          return true; // Rollback transaction on error
        }
      );
    });
  };

  const loadTrack = async (index: number) => {
    if (sound) {
      await sound.unloadAsync();
    }

    try {
      const track = songs[index].uri;
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: track },
        { shouldPlay: false }
      );

      setSound(newSound);
      setIsSoundLoaded(true);
    } catch (error) {
      console.error('Error loading audio track:', error);
    }
  };

  const playPauseTrack = async () => {
    if (!sound || !isSoundLoaded) {
      console.warn('Sound is not loaded yet.');
      return; // Do nothing if sound is not loaded
    }

    try {
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
      setIsPlaying(!isPlaying);
    } catch (error) {
      console.error('Error in play/pause:', error);
    }
  };

  const stopTrack = async () => {
    if (sound && isSoundLoaded) {
      try {
        await sound.stopAsync();
        setIsPlaying(false);
      } catch (error) {
        console.error('Error stopping the track:', error);
      }
    } else {
      console.warn('Sound is not loaded, unable to stop.');
    }
  };

  const nextTrack = async () => {
    const nextIndex = (currentTrackIndex + 1) % songs.length;
    setCurrentTrackIndex(nextIndex);
    await loadTrack(nextIndex);
    playPauseTrack(); // Autoplay after loading
  };

  const previousTrack = async () => {
    const prevIndex = (currentTrackIndex - 1 + songs.length) % songs.length;
    setCurrentTrackIndex(prevIndex);
    await loadTrack(prevIndex);
    playPauseTrack(); // Autoplay after loading
  };

  useEffect(() => {
    loadTrack(currentTrackIndex);

    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [currentTrackIndex]);

  const renderSongItem = ({ item, index }: { item: Song; index: number }) => (
    <TouchableOpacity onPress={() => setCurrentTrackIndex(index)}>
      <View style={styles.songItem}>
        <Image
          source={{ uri: item.image }}
          style={styles.thumbnail}
        />
        <Text style={styles.songTitle}>{item.title}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {songs.length > 0 && songs[currentTrackIndex] ? (
        <>
          <Text style={styles.title}>{songs[currentTrackIndex].title}</Text>
          <Image
            source={{ uri: songs[currentTrackIndex].image }}
            style={styles.image}
          />
          <View style={styles.controls}>
            <TouchableOpacity style={styles.button} onPress={previousTrack}>
              <Text style={styles.buttonText}>Previous</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={playPauseTrack}>
              <Text style={styles.buttonText}>{isPlaying ? 'Pause' : 'Play'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={stopTrack}>
              <Text style={styles.buttonText}>Stop</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={nextTrack}>
              <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <Text>Loading songs...</Text> // Placeholder until songs are loaded
      )}
      <FlatList
        data={songs}
        renderItem={renderSongItem}
        keyExtractor={item => item.id.toString()}
        style={styles.songList}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000', // Black background
  },
  title: {
    fontSize: 24,
    color: '#fff',
    marginBottom: 20,
  },
  image: {
    width: 300,
    height: 300,
    marginBottom: 20,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  songTitle: {
    color: '#fff',
    marginLeft: 10,
    fontSize: 18,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 20,
    width: '100%',
  },
  button: {
    backgroundColor: 'purple', // Purple button color
    padding: 10,
    borderRadius: 5,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
  },
  thumbnail: {
    width: 50,
    height: 50,
  },
  songList: {
    marginTop: 20,
    width: '100%',
  },
});
