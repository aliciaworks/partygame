class_name PartyGameSDK
extends Node

var http_client: HTTPClient
var ws_peer: WebSocketPeer
var base_url: String = ""
var token: String = ""
var player_id: String = ""

signal on_message_received(message: Dictionary)
signal on_binary_received(data: PackedByteArray)

func _ready():
    http_client = HTTPClient.new()
    ws_peer = WebSocketPeer.new()

func initialize(url: String):
    base_url = url.trim_suffix("/")

func login(pid: String, pname: String) -> Dictionary:
    var request = HTTPRequest.new()
    add_child(request)
    var url = base_url + "/auth/login"
    var body = JSON.stringify({"playerId": pid, "playerName": pname})
    var headers = ["Content-Type: application/json"]
    
    request.request(url, headers, HTTPClient.METHOD_POST, body)
    var result = await request.request_completed
    
    var response_code = result[1]
    var response_body = result[3].get_string_from_utf8()
    var data = JSON.parse_string(response_body)
    
    if response_code == 200:
        token = data.get("token", "")
        player_id = data.get("playerId", "")
    
    request.queue_free()
    return data

func join_matchmaker(game_type: String = "moba") -> void:
    var request = HTTPRequest.new()
    add_child(request)
    var url = base_url + "/matchmaking/join"
    var body = JSON.stringify({"playerId": player_id, "gameType": game_type})
    var headers = ["Content-Type: application/json"]
    
    request.request(url, headers, HTTPClient.METHOD_POST, body)
    await request.request_completed
    request.queue_free()

func connect_websocket(room_id: String, game_type: String = "moba") -> void:
    var ws_url = base_url.replace("http", "ws") + "/ws?roomId=" + room_id + "&playerId=" + player_id + "&token=" + token + "&gameType=" + game_type
    ws_peer.connect_to_url(ws_url)

func _process(_delta):
    ws_peer.poll()
    var state = ws_peer.get_ready_state()
    if state == WebSocketPeer.STATE_OPEN:
        while ws_peer.get_available_packet_count():
            var is_text = ws_peer.was_string_packet()
            var packet = ws_peer.get_packet()
            if is_text:
                var text = packet.get_string_from_utf8()
                emit_signal("on_message_received", JSON.parse_string(text))
            else:
                emit_signal("on_binary_received", packet)

func send_binary(data: PackedByteArray) -> void:
    if ws_peer.get_ready_state() == WebSocketPeer.STATE_OPEN:
        ws_peer.put_packet(data)
