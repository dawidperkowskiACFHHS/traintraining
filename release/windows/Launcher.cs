using System;
using System.IO;
using System.Text;
using System.Net;
using System.Net.Sockets;
using System.Threading;
using System.Threading.Tasks;
using System.Diagnostics;
using System.Windows.Forms;
[assembly:System.Reflection.AssemblyTitle("Last Stop")]
[assembly:System.Reflection.AssemblyDescription("Local offline game launcher")]
[assembly:System.Reflection.AssemblyVersion("1.1.0.0")]
internal static class Launcher {
  const int Port=53621;
  static readonly string Root=Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"game"));
  static DateTime LastPing=DateTime.UtcNow;
  [STAThread] static void Main(string[] args) {
    bool only=Array.IndexOf(args,"--serve-only")>=0;
    try {
      if(!File.Exists(Path.Combine(Root,"index.html")))throw new Exception("Extract the whole download before starting Last Stop.exe. The game folder must stay beside the launcher.");
      var server=new TcpListener(IPAddress.Loopback,Port);
      var restart=new EventWaitHandle(false,EventResetMode.AutoReset,"Local\\LastStop-Restart-"+Environment.UserName);
      try{server.Start();}catch(SocketException){
        using(var client=new WebClient()){if(!client.DownloadString("http://127.0.0.1:"+Port+"/__desktop").Contains("last-stop"))throw new Exception("The game's local port is busy. Close the other application and try again.");}
        if(only)throw new Exception("Close the running game before running packaged verification.");
        restart.Set();bool bound=false;
        for(int attempt=0;attempt<30;attempt++){Thread.Sleep(100);try{server.Start();bound=true;break;}catch(SocketException){}}
        if(!bound)throw new Exception("The previous game server is still closing. Try launching again in a moment.");
      }
      if(!only)OpenGame();
      var previous=DateTime.UtcNow;
      while(true){
        if(restart.WaitOne(0))break;
        var now=DateTime.UtcNow;if((now-previous).TotalSeconds>30)LastPing=now;previous=now;
        if((now-LastPing).TotalSeconds>180)break;
        if(server.Pending()){var client=server.AcceptTcpClient();Task.Run(()=>Handle(client));}else Thread.Sleep(30);
      }
      server.Stop();
      restart.Dispose();
    }catch(Exception e){if(only){File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"launcher-error.txt"),e.Message);}else MessageBox.Show(e.Message,"Last Stop",MessageBoxButtons.OK,MessageBoxIcon.Information);}
  }
  static void OpenGame(){
    string[] locations={Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),"Microsoft","Edge","Application","msedge.exe"),Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"Microsoft","Edge","Application","msedge.exe")};
    string edge=Array.Find(locations,File.Exists);if(edge==null)throw new Exception("This Windows build needs Microsoft Edge. You can also play the hosted browser build in a supported desktop browser.");
    var profile=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"LastStop","Browser");
    Directory.CreateDirectory(profile);
    Process.Start(new ProcessStartInfo(edge,"--no-first-run --app=http://127.0.0.1:"+Port+"/ --user-data-dir=\""+profile+"\""){UseShellExecute=false});
  }
  static void Handle(TcpClient client){
    using(client){try{
      client.ReceiveTimeout=3000;client.SendTimeout=5000;
      var stream=client.GetStream();var request=new StringBuilder();int value;
      while(request.Length<16384&&(value=stream.ReadByte())>=0){request.Append((char)value);if(request.ToString().EndsWith("\r\n\r\n"))break;}
      string[] parts=request.ToString().Split(new[]{' ','\r','\n'},StringSplitOptions.RemoveEmptyEntries);
      if(parts.Length<2)return;
      bool head=parts[0]=="HEAD";if(parts[0]!="GET"&&!head){Send(stream,405,"text/plain",Encoding.UTF8.GetBytes("Read-only game server"),head);return;}
      string path=Uri.UnescapeDataString(new Uri("http://localhost"+parts[1]).AbsolutePath);
      if(path=="/__alive"){LastPing=DateTime.UtcNow;Send(stream,200,"text/plain",Encoding.UTF8.GetBytes("ok"),head);return;}
      if(path=="/__desktop"){LastPing=DateTime.UtcNow;Send(stream,200,"application/json",Encoding.UTF8.GetBytes("{\"app\":\"last-stop\",\"version\":\"1.1.0-rc.2\"}"),head);return;}
      if(path=="/")path="/index.html";
      string file=Path.GetFullPath(Path.Combine(Root,path.TrimStart('/').Replace('/',Path.DirectorySeparatorChar)));
      if(!file.StartsWith(Root+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase)||!File.Exists(file)){Send(stream,404,"text/plain",Encoding.UTF8.GetBytes("Not found"),head);return;}
      string mime="application/octet-stream";
      switch(Path.GetExtension(file).ToLowerInvariant()){case ".html":mime="text/html; charset=utf-8";break;case ".js":mime="text/javascript";break;case ".css":mime="text/css";break;case ".json":case ".webmanifest":mime="application/json";break;case ".svg":mime="image/svg+xml";break;case ".webp":mime="image/webp";break;case ".png":mime="image/png";break;case ".ico":mime="image/x-icon";break;case ".ttf":mime="font/ttf";break;case ".txt":mime="text/plain; charset=utf-8";break;}
      Send(stream,200,mime,File.ReadAllBytes(file),head);
    }catch{/* A closed browser request must not terminate the game server. */}}
  }
  static void Send(Stream stream,int status,string mime,byte[] body,bool head){
    var header=Encoding.ASCII.GetBytes("HTTP/1.1 "+status+" "+(status==200?"OK":"Error")+"\r\nContent-Type: "+mime+"\r\nContent-Length: "+body.Length+"\r\nCache-Control: no-cache\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n");stream.Write(header,0,header.Length);if(!head)stream.Write(body,0,body.Length);
  }
}
