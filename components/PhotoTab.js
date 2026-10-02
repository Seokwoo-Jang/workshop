'use client';
export default function PhotoTab({ room }) {
  return (
    <div>
      <h2>사진</h2>
      <p className="sub">워크숍 사진은 공유 앨범에 모아주세요</p>
      {room.album_url ? (
        <a className="btn primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
          href={room.album_url} target="_blank" rel="noopener noreferrer">📸 공유 앨범 열기</a>
      ) : (
        <p className="empty-note">공유 앨범 링크가 아직 없습니다.<br />관리자가 등록하면 여기에 버튼이 생깁니다.</p>
      )}
    </div>
  );
}
